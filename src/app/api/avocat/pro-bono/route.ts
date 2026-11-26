// Intervention sans honoraires : l'associé propose la prise en charge d'un pré-dossier à l'avocat choisi.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { proposerProBono } from "@/lib/serveur/probono";
import { membreConnecte } from "@/lib/serveur/session";

const Corps = z.object({ reference: z.string().max(20), avocatId: z.string().min(1).max(40) });

export async function POST(req: Request) {
  const m = await membreConnecte();
  if (!m) return NextResponse.json({ erreur: "Session expirée." }, { status: 401 });
  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Choisissez l'avocat." }, { status: 400 });
  const r = await proposerProBono(await db(), m, c.data.reference, c.data.avocatId);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
}
