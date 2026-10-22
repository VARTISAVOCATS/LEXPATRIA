// Tâche planifiée (cron OVH toutes les 15 minutes) : relances et purge des pré-dossiers.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { relancer } from "@/lib/serveur/relances";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!process.env.SECRET_TACHES || req.headers.get("authorization") !== `Bearer ${process.env.SECRET_TACHES}`)
    return NextResponse.json({ erreur: "Non autorisé" }, { status: 401 });
  return NextResponse.json(await relancer(await db()));
}
