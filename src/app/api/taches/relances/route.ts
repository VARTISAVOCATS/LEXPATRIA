// Tâche planifiée (cron OVH toutes les 15 minutes) : relances et purge des pré-dossiers,
// rappels des échéances aux avocats (la veille et le jour).
import { NextResponse } from "next/server";
import { db } from "@/db";
import { rappelerEcheances } from "@/lib/serveur/agenda";
import { relancer } from "@/lib/serveur/relances";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!process.env.SECRET_TACHES || req.headers.get("authorization") !== `Bearer ${process.env.SECRET_TACHES}`)
    return NextResponse.json({ erreur: "Non autorisé" }, { status: 401 });
  const d = await db();
  return NextResponse.json({ ...(await relancer(d)), ...(await rappelerEcheances(d)) });
}
