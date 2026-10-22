// Téléchargement d'un fichier de pièce : client propriétaire du dossier, ou membre du cabinet habilité.
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { journaliser } from "@/lib/journal";
import { voitTout } from "@/lib/serveur/dossiers";
import { clientConnecte, membreConnecte } from "@/lib/serveur/session";
import { lire, type FichierStocke } from "@/lib/serveur/stockage";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const pieceId = u.searchParams.get("piece") ?? "";
  const i = Number(u.searchParams.get("i") ?? "0");
  const d = await db();
  const [p] = await d.select().from(schema.pieces).where(eq(schema.pieces.id, pieceId));
  if (!p) return new Response("Introuvable", { status: 404 });
  const [dos] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, p.dossierId));

  let acteur: string | null = null;
  const m = await membreConnecte();
  if (m && (voitTout(m) || dos.avocatId === m.id)) acteur = m.id;
  if (!acteur) {
    const email = await clientConnecte();
    if (email && dos.statut !== "PRE_DOSSIER") {
      const [c] = await d.select().from(schema.clients).where(sql`${schema.clients.id} = ${dos.clientId} and lower(${schema.clients.email}) = ${email}`);
      if (c) acteur = "CLIENT";
    }
  }
  if (!acteur) return new Response("Accès refusé", { status: 403 });

  const f = ((p.fichiers as FichierStocke[]) ?? [])[i];
  if (!f) return new Response("Introuvable", { status: 404 });
  const donnees = await lire(f.cle);
  await journaliser(d, { dossierId: dos.id, acteur, action: "PIECE_CONSULTEE", details: { pieceId: p.id, i } });
  return new Response(new Uint8Array(donnees), {
    headers: {
      "content-type": f.mime,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(f.nom)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
