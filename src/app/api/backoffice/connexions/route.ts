// Back office : connexions aux API (associés seulement). Les valeurs ne transitent que du navigateur vers le serveur.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { enregistrerConnexion, testerConnexion } from "@/lib/serveur/connexions";
import { membreConnecte } from "@/lib/serveur/session";

const Corps = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enregistrer"), service: z.string().max(40), valeurs: z.record(z.string(), z.string().max(2000)) }),
  z.object({ action: z.literal("tester"), service: z.string().max(40) }),
]);

export async function POST(req: Request) {
  const m = await membreConnecte();
  if (!m || m.role !== "ASSOCIE") return NextResponse.json({ erreur: "Réservé aux associés." }, { status: 403 });
  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  const d = await db();
  if (c.data.action === "tester") return NextResponse.json(await testerConnexion(d, c.data.service, m.id));
  const r = await enregistrerConnexion(d, c.data.service, c.data.valeurs, m.id);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
}
