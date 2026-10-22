// Pièce ajoutée par le cabinet (pièce reçue par un autre canal, décision, accusé de réception…).
import { NextResponse } from "next/server";
import { db } from "@/db";
import { accesEquipe, ajouterPiece } from "@/lib/serveur/dossiers";
import { membreConnecte } from "@/lib/serveur/session";
import { lireFichiers } from "@/lib/serveur/televersement";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const m = await membreConnecte();
  if (!m) return NextResponse.json({ erreur: "Session expirée." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ erreur: "Envoi invalide." }, { status: 400 });
  const d = await db();
  const dos = await accesEquipe(d, m, String(form.get("reference") ?? ""));
  if (!dos) return NextResponse.json({ erreur: "Dossier introuvable." }, { status: 404 });
  const lus = await lireFichiers(form);
  if ("erreur" in lus) return NextResponse.json({ erreur: lus.erreur }, { status: lus.statut });
  await ajouterPiece(d, dos, String(form.get("libelle") ?? ""), lus.fichiers, m.id);
  return NextResponse.json({ ok: true });
}
