// Message du cabinet au client.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { accesEquipe, ajouterMessage } from "@/lib/serveur/dossiers";
import { membreConnecte } from "@/lib/serveur/session";

const Corps = z.object({ reference: z.string().max(20), contenu: z.string().min(1).max(5000) });

export async function POST(req: Request) {
  const m = await membreConnecte();
  if (!m) return NextResponse.json({ erreur: "Session expirée." }, { status: 401 });
  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Message vide ou trop long." }, { status: 400 });
  const d = await db();
  const dos = await accesEquipe(d, m, c.data.reference);
  if (!dos) return NextResponse.json({ erreur: "Dossier introuvable." }, { status: 404 });
  await ajouterMessage(d, dos, m.role === "SECRETARIAT" ? "SECRETARIAT" : "AVOCAT", m.id, c.data.contenu);
  return NextResponse.json({ ok: true });
}
