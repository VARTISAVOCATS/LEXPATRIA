// Ouverture du paiement intégré (cahier des charges, 4.10 et 5.1 à 5.3).
// Deux entrées : le client (jeton du dépôt, après acceptation de la convention)
// ou le proche (jeton de règlement, la convention ayant déjà été acceptée par le client).

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { verifier } from "@/lib/jeton";
import { accepterConvention, charger, creerIntention, marquerPaye } from "@/lib/serveur/paiement";

export const runtime = "nodejs";

const Corps = z.union([
  z.object({ jeton: z.string(), accepteConvention: z.literal(true), executionImmediate: z.literal(true) }),
  z.object({ jetonProche: z.string() }),
]);

export async function POST(req: Request) {
  const p = Corps.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ erreur: "Cochez les deux cases pour continuer." }, { status: 400 });

  const corps = p.data;
  const proche = "jetonProche" in corps;
  const dossierId = "jetonProche" in corps ? verifier(corps.jetonProche, "proche") : verifier(corps.jeton);
  if (!dossierId) return NextResponse.json({ erreur: "Lien expiré." }, { status: 401 });

  const d = await db();
  const c = await charger(d, dossierId);
  const attendu = proche ? "ATTENTE_PROCHE" : "PRE_DOSSIER";
  if (!c || c.dos.statut !== attendu) return NextResponse.json({ erreur: "Ce dossier ne peut plus être réglé ici." }, { status: 409 });

  if (!proche) {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "inconnue";
    await accepterConvention(d, c.dos, c.cli, ip);
  }
  const r = await creerIntention(d, c.dos, c.cli, proche);

  if (r.simulation) {
    // Développement sans clé Stripe : paiement simulé, confirmé immédiatement.
    if (process.env.NODE_ENV === "production" && !process.env.AUTORISER_SIMULATION)
      return NextResponse.json({ erreur: "Paiement indisponible." }, { status: 503 });
    await marquerPaye(d, dossierId, { paiementId: r.paiementId, moyen: "simulation" });
    return NextResponse.json({ simulation: true, reference: c.dos.reference });
  }
  return NextResponse.json({ clientSecret: r.clientSecret, reference: c.dos.reference });
}
