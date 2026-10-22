// Dépôt des pièces : plusieurs fichiers par pièce, ou « Je ne l'ai pas » (cahier des charges, 4.9 et 6.0).
// Avant paiement, l'accès passe par le jeton du dépôt ; après paiement, par la session de l'espace client (lot 2).

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { verifier } from "@/lib/jeton";
import { journaliser } from "@/lib/journal";
import { enregistrer, TAILLE_MAX, typeAccepte, type FichierStocke } from "@/lib/serveur/stockage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ erreur: "Envoi invalide." }, { status: 400 });
  const id = verifier(String(form.get("jeton") ?? ""));
  if (!id) return NextResponse.json({ erreur: "Session expirée." }, { status: 401 });
  const type = String(form.get("type") ?? "").slice(0, 40);
  const libelle = String(form.get("libelle") ?? "").slice(0, 200);
  const manquante = form.get("manquante") === "1";
  if (!type || !libelle) return NextResponse.json({ erreur: "Pièce inconnue." }, { status: 400 });

  const d = await db();
  const [dos] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, id));
  if (!dos || dos.statut !== "PRE_DOSSIER") return NextResponse.json({ erreur: "Dossier introuvable." }, { status: 404 });

  const nouveaux: FichierStocke[] = [];
  for (const f of form.getAll("fichiers")) {
    if (!(f instanceof File)) continue;
    if (!typeAccepte(f.type)) return NextResponse.json({ erreur: "Format non accepté : photo ou PDF uniquement." }, { status: 415 });
    if (f.size > TAILLE_MAX) return NextResponse.json({ erreur: "Fichier trop lourd (20 Mo au plus)." }, { status: 413 });
    nouveaux.push(await enregistrer(dos.reference, f.name, f.type, Buffer.from(await f.arrayBuffer())));
  }

  const [existante] = await d
    .select()
    .from(schema.pieces)
    .where(and(eq(schema.pieces.dossierId, id), eq(schema.pieces.type, type)));
  if (existante) {
    const fichiers = [...((existante.fichiers as FichierStocke[]) ?? []), ...nouveaux];
    await d
      .update(schema.pieces)
      .set({ fichiers, manquante: manquante && fichiers.length === 0 })
      .where(eq(schema.pieces.id, existante.id));
  } else {
    await d.insert(schema.pieces).values({ dossierId: id, type, libelle, fichiers: nouveaux, manquante: manquante && nouveaux.length === 0 });
  }
  await journaliser(d, {
    dossierId: id,
    acteur: "CLIENT",
    action: manquante ? "PIECE_INDISPONIBLE" : "PIECE_DEPOSEE",
    details: { type, fichiers: nouveaux.map((f) => ({ nom: f.nom, empreinte: f.empreinte })) },
  });
  return NextResponse.json({ ok: true, nombre: nouveaux.length });
}
