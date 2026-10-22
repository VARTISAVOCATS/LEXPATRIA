// Consultation en visio (89 €) : création du pré-dossier avant le paiement. Adresse postale exigée.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, prochainCodeClient, prochaineReference, schema } from "@/db";
import { signer } from "@/lib/jeton";
import { journaliser } from "@/lib/journal";
import { adresseComplete } from "@/lib/pays";

export const runtime = "nodejs";

const Corps = z.object({
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
  question: z.string().trim().min(10).max(3000),
  langue: z.string().max(5).default("fr"),
  source: z.string().max(60).optional(),
});

export async function POST(req: Request) {
  const p = Corps.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ erreur: "Vérifiez les informations saisies." }, { status: 400 });
  const c = p.data;
  if (!adresseComplete(c.coordonnees)) return NextResponse.json({ erreur: "Vérifiez votre adresse postale." }, { status: 400 });
  const d = await db();
  const dos = await d.transaction(async (tx) => {
    const base = tx as unknown as typeof d;
    const [client] = await tx
      .insert(schema.clients)
      .values({ code: await prochainCodeClient(base), ...c.coordonnees, email: c.coordonnees.email.toLowerCase(), langue: c.langue })
      .returning();
    const [dossier] = await tx
      .insert(schema.dossiers)
      .values({
        reference: await prochaineReference(base),
        clientId: client.id,
        procedure: "CONSULTATION",
        traitement: "DIRECT",
        recit: c.question,
        qualification: { question: c.question },
        source: c.source ?? null,
      })
      .returning();
    await journaliser(base, { dossierId: dossier.id, acteur: "CLIENT", action: "PRE_DOSSIER_CREE", details: { procedure: "CONSULTATION" } });
    return dossier;
  });
  return NextResponse.json({ reference: dos.reference, jeton: signer(dos.id), jetonRdv: signer(dos.id, 24 * 30, "rdv") });
}
