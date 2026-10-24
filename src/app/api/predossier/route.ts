// Création du pré-dossier à l'écran « Coordonnées » (cahier des charges, 4.10).
// Seul le minimum est demandé avant paiement ; tout le reste vient après.

import { NextResponse } from "next/server";
import { adresseComplete } from "@/lib/pays";
import { z } from "zod";
import { db, prochainCodeClient, prochaineReference, schema } from "@/db";
import { jour, versJour } from "@/lib/calendrier";
import { evaluerDelai } from "@/lib/delais";
import { signer } from "@/lib/jeton";
import { journaliser } from "@/lib/journal";
import { PROCEDURES, type CodeProcedure } from "@/lib/procedures";

export const runtime = "nodejs";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

const Corps = z.object({
  procedure: z.enum(Object.keys(PROCEDURES) as [CodeProcedure, ...CodeProcedure[]]),
  situationOQTF: z.enum(["LIBRE", "ASSIGNE", "LIBRE_APRES_ASILE", "INCONNUE"]).nullable().optional(),
  dateEcheance: date,
  qualification: z
    .object({
      visaType: z.enum(["COURT", "LONG"]).nullable().optional(),
      naturalisationIssue: z.enum(["REFUS", "AJOURNEMENT"]).nullable().optional(),
      emploiMenace: z.boolean().nullable().optional(),
      question: z.string().max(3000).nullable().optional(),
      silenceApresRecoursPrealable: z.boolean().optional(),
    })
    .default({}),
  dateReference: date, // réception de la décision (confirmée par le client)
  dateDemande: date,
  recit: z.string().max(8000).optional(),
  triage: z.unknown().optional(),
  avisPrealable: z.boolean().default(false),
  coordonnees: z.object({
    civilite: z.enum(["MADAME", "MONSIEUR"]),
    prenom: z.string().trim().min(1).max(80),
    nom: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(200),
    telephone: z.string().trim().min(6).max(30),
    adresse: z.string().trim().min(5).max(200),
    codePostal: z.string().trim().max(20).default(""),
    ville: z.string().trim().min(2).max(100),
    pays: z.string().length(2),
  }),
  algerien: z.boolean().nullable().optional(),
  langue: z.string().max(5).default("fr"),
  source: z.string().max(60).optional(),
});

const enDate = (s?: string | null) => {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return jour(y, m, d);
};

export async function POST(req: Request) {
  const p = Corps.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ erreur: "Vérifiez les informations saisies." }, { status: 400 });
  const c = p.data;
  if (!adresseComplete(c.coordonnees)) return NextResponse.json({ erreur: "Vérifiez votre adresse postale." }, { status: 400 });

  // Le délai est recalculé côté serveur : le navigateur n'est jamais cru sur parole.
  const delai = evaluerDelai({
    procedure: c.procedure,
    situationOQTF: c.situationOQTF ?? undefined,
    dateReference: enDate(c.dateReference),
    dateDemande: enDate(c.dateDemande),
    dateEcheance: enDate(c.dateEcheance),
    silenceApresRecoursPrealable: c.qualification.silenceApresRecoursPrealable,
    aujourdhui: versJour(new Date()),
  });
  if (delai.traitement === "REFUSE") return NextResponse.json({ erreur: "Dépôt en ligne impossible." }, { status: 422 });
  if (delai.traitement === "EXPIRE" && !c.avisPrealable)
    return NextResponse.json({ erreur: "Le délai déclaré est dépassé : seul l'avis d'un avocat peut être demandé." }, { status: 422 });
  if (c.avisPrealable && !delai.avisPossible && delai.traitement !== "EXPIRE")
    return NextResponse.json({ erreur: "Le délai restant ne permet pas un avis préalable." }, { status: 422 });

  const d = await db();
  const res = await d.transaction(async (tx) => {
    const base = tx as unknown as typeof d;
    const [client] = await tx
      .insert(schema.clients)
      .values({
        code: await prochainCodeClient(base),
        ...c.coordonnees,
        algerien: c.algerien ?? null,
        langue: c.langue,
        // Relance par e-mail en cas d'abandon, sans case à cocher ; le lien de désinscription l'arrête.
        consentRelances: true,
      })
      .returning();
    const [dossier] = await tx
      .insert(schema.dossiers)
      .values({
        reference: await prochaineReference(base),
        clientId: client.id,
        procedure: c.procedure,
        traitement: delai.traitement,
        situationOQTF: c.situationOQTF ?? null,
        recit: c.recit ?? null,
        triage: c.triage ?? null,
        qualification: { ...c.qualification, dateDemande: c.dateDemande ?? null, dateEcheance: c.dateEcheance ?? null },
        dateNotification: c.dateReference ?? null,
        dateLimite: delai.dateLimite?.toISOString().slice(0, 10) ?? null,
        avisPrealable: c.avisPrealable,
        source: c.source ?? null,
      })
      .returning();
    await journaliser(base, {
      dossierId: dossier.id,
      acteur: "CLIENT",
      action: "PRE_DOSSIER_CREE",
      details: { procedure: c.procedure, traitement: delai.traitement, relances: true },
    });
    return dossier;
  });

  return NextResponse.json({ reference: res.reference, jeton: signer(res.id), traitement: delai.traitement });
}
