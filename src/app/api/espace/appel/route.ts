// Espace client : accord sur l'appel proposé (avenant + paiement) ou renonciation.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { renoncerAppel } from "@/lib/serveur/appel";
import { accesClient } from "@/lib/serveur/dossiers";
import { accepterConvention, charger, creerIntention, marquerPaye } from "@/lib/serveur/paiement";
import { clientConnecte } from "@/lib/serveur/session";

export const runtime = "nodejs";

const Corps = z.union([
  z.object({ reference: z.string().max(20), action: z.literal("payer"), accepteConvention: z.literal(true), executionImmediate: z.literal(true) }),
  z.object({ reference: z.string().max(20), action: z.literal("renoncer") }),
]);

export async function POST(req: Request) {
  const email = await clientConnecte();
  if (!email) return NextResponse.json({ erreur: "Session expirée." }, { status: 401 });
  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Cochez les deux cases pour continuer." }, { status: 400 });
  const d = await db();
  const dos = await accesClient(d, email, c.data.reference);
  if (!dos || !dos.dossierParentId) return NextResponse.json({ erreur: "Dossier introuvable." }, { status: 404 });
  if (dos.statut !== "APPEL_PROPOSE") return NextResponse.json({ erreur: "Cet appel n'est plus en attente de votre décision." }, { status: 409 });

  if (c.data.action === "renoncer") {
    const r = await renoncerAppel(d, dos);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erreur: r.erreur }, { status: 409 });
  }

  const x = (await charger(d, dos.id))!;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "inconnue";
  await accepterConvention(d, x.dos, x.cli, ip);
  const r = await creerIntention(d, x.dos, x.cli, false);
  if (r.simulation) {
    if (process.env.NODE_ENV === "production" && !process.env.AUTORISER_SIMULATION) return NextResponse.json({ erreur: "Paiement indisponible." }, { status: 503 });
    await marquerPaye(d, dos.id, { paiementId: r.paiementId, moyen: "simulation" });
    return NextResponse.json({ simulation: true, reference: dos.reference });
  }
  return NextResponse.json({ clientSecret: r.clientSecret, reference: dos.reference });
}
