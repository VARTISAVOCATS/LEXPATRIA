// Ajout de pièces par le client après le paiement (nouvelle pièce, ou pièce signalée « Je ne l'ai pas »).
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { journaliser } from "@/lib/journal";
import { accesClient, ajouterPiece } from "@/lib/serveur/dossiers";
import { clientConnecte } from "@/lib/serveur/session";
import { enregistrer, type FichierStocke } from "@/lib/serveur/stockage";
import { lireFichiers } from "@/lib/serveur/televersement";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const email = await clientConnecte();
  if (!email) return NextResponse.json({ erreur: "Session expirée." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ erreur: "Envoi invalide." }, { status: 400 });
  const d = await db();
  const dos = await accesClient(d, email, String(form.get("reference") ?? ""));
  if (!dos) return NextResponse.json({ erreur: "Dossier introuvable." }, { status: 404 });
  const lus = await lireFichiers(form);
  if ("erreur" in lus) return NextResponse.json({ erreur: lus.erreur }, { status: lus.statut });

  const pieceId = String(form.get("pieceId") ?? "");
  if (pieceId) {
    const [p] = await d.select().from(schema.pieces).where(and(eq(schema.pieces.id, pieceId), eq(schema.pieces.dossierId, dos.id)));
    if (!p) return NextResponse.json({ erreur: "Pièce introuvable." }, { status: 404 });
    const nouveaux: FichierStocke[] = [];
    for (const f of lus.fichiers) nouveaux.push(await enregistrer(dos.reference, f.nom, f.mime, f.donnees));
    await d
      .update(schema.pieces)
      .set({ fichiers: [...((p.fichiers as FichierStocke[]) ?? []), ...nouveaux], manquante: false, verifiee: false })
      .where(eq(schema.pieces.id, p.id));
    await journaliser(d, { dossierId: dos.id, acteur: "CLIENT", action: "PIECE_COMPLETEE", details: { pieceId: p.id, fichiers: nouveaux.length } });
  } else {
    await ajouterPiece(d, dos, String(form.get("libelle") ?? ""), lus.fichiers, "CLIENT");
  }
  return NextResponse.json({ ok: true });
}
