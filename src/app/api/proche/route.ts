// « Faire régler par un proche » (cahier des charges, 5.3) : le client accepte la convention,
// puis transmet un lien de règlement. Le dossier reste à son nom ; le proche ne voit que la référence,
// la procédure, le montant et le nom du client, jamais le récit ni les pièces.

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { signer, verifier } from "@/lib/jeton";
import { journaliser } from "@/lib/journal";
import { adresseComplete } from "@/lib/pays";
import { accepterConvention, charger } from "@/lib/serveur/paiement";

export const runtime = "nodejs";

const Corps = z.object({
  jeton: z.string(),
  accepteConvention: z.literal(true),
  executionImmediate: z.literal(true),
  prenomProche: z.string().trim().max(60).optional(),
});

export async function POST(req: Request) {
  const p = Corps.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ erreur: "Cochez les deux cases pour continuer." }, { status: 400 });
  const dossierId = verifier(p.data.jeton);
  if (!dossierId) return NextResponse.json({ erreur: "Session expirée, recommencez le dépôt." }, { status: 401 });

  const d = await db();
  const c = await charger(d, dossierId);
  if (!c || c.dos.statut !== "PRE_DOSSIER") return NextResponse.json({ erreur: "Dossier introuvable." }, { status: 404 });
  if (!adresseComplete(c.cli)) return NextResponse.json({ erreur: "Votre adresse postale est incomplète : revenez à l'étape « Vos coordonnées »." }, { status: 409 });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "inconnue";
  await accepterConvention(d, c.dos, c.cli, ip);
  await d.update(schema.dossiers).set({ statut: "ATTENTE_PROCHE", majLe: new Date() }).where(eq(schema.dossiers.id, dossierId));
  await journaliser(d, { dossierId, acteur: "CLIENT", action: "REGLEMENT_PAR_PROCHE_DEMANDE", details: { prenomProche: p.data.prenomProche ?? null } });

  const origine = process.env.URL_PUBLIQUE ?? new URL(req.url).origin;
  return NextResponse.json({ lien: `${origine}/regler/${signer(dossierId, 24 * 14, "proche")}`, reference: c.dos.reference });
}
