// Archive de dépôt Télérecours (requête attestée et pièces numérotées, en PDF).
import { db } from "@/db";
import { journaliser } from "@/lib/journal";
import { accesEquipe } from "@/lib/serveur/dossiers";
import { paquetTelerecours } from "@/lib/serveur/integrations/telerecours";
import { membreConnecte } from "@/lib/serveur/session";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const m = await membreConnecte();
  if (!m) return new Response("Session expirée.", { status: 401 });
  const { reference } = await params;
  const d = await db();
  const dos = await accesEquipe(d, m, reference);
  if (!dos) return new Response("Dossier introuvable.", { status: 404 });
  const r = await paquetTelerecours(d, dos);
  if (!r.ok) return new Response(r.erreur, { status: 422, headers: { "content-type": "text/plain; charset=utf-8" } });
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "PAQUET_TELERECOURS", details: { ignores: r.ignores } });
  return new Response(r.zip as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${r.nom}"`,
      "cache-control": "no-store",
      // Pièces non converties en PDF (à ajouter à la main dans Télérecours).
      ...(r.ignores.length ? { "x-pieces-ignorees": encodeURIComponent(r.ignores.join(" ; ")) } : {}),
    },
  });
}
