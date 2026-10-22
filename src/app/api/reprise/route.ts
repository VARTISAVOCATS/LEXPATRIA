// Reprise d'un pré-dossier au point d'arrêt (lien des relances, retour de paiement annulé).
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { verifier } from "@/lib/jeton";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const jeton = new URL(req.url).searchParams.get("jeton") ?? "";
  const id = verifier(jeton);
  if (!id) return NextResponse.json({ erreur: "Lien expiré : recommencez votre dépôt." }, { status: 401 });
  const d = await db();
  const [dos] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, id));
  if (!dos || dos.statut !== "PRE_DOSSIER") return NextResponse.json({ erreur: "Ce dossier n'est plus en attente." }, { status: 409 });
  const [cli] = await d.select().from(schema.clients).where(eq(schema.clients.id, dos.clientId));
  const q = (dos.qualification ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    jeton,
    reference: dos.reference,
    procedure: dos.procedure,
    situationOQTF: dos.situationOQTF,
    dateReference: dos.dateNotification,
    dateDemande: q.dateDemande ?? null,
    dateEcheance: q.dateEcheance ?? null,
    avisPrealable: dos.avisPrealable,
    triage: dos.triage,
    qualification: q,
    etapeAtteinte: dos.etapeAtteinte,
    coordonnees: { civilite: cli.civilite ?? "", prenom: cli.prenom ?? "", nom: cli.nom ?? "", email: cli.email ?? "", telephone: cli.telephone ?? "", adresse: cli.adresse ?? "", codePostal: cli.codePostal ?? "", ville: cli.ville ?? "", pays: cli.pays ?? "FR" },
    algerien: cli.algerien,
  });
}
