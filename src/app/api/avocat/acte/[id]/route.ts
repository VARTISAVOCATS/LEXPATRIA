// Téléchargement d'un acte pour Word (.docx), mis en page sur le modèle du cabinet ; les mentions XXX sont surlignées en jaune.
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { journaliser } from "@/lib/journal";
import { voitTout } from "@/lib/serveur/dossiers";
import { acteVersDocx } from "@/lib/serveur/docx-acte";
import { membreConnecte } from "@/lib/serveur/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = await membreConnecte();
  if (!m) return new Response("Session expirée", { status: 401 });
  const { id } = await params;
  const d = await db();
  const [acte] = await d.select().from(schema.actes).where(eq(schema.actes.id, id));
  if (!acte) return new Response("Introuvable", { status: 404 });
  const [dos] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, acte.dossierId));
  if (!voitTout(m) && dos.avocatId !== m.id) return new Response("Accès refusé", { status: 403 });
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "ACTE_TELECHARGE", details: { acteId: acte.id, version: acte.version } });
  const fichier = await acteVersDocx(acte.contenu);
  return new Response(new Uint8Array(fichier), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${dos.reference}-${acte.type}-v${acte.version}.docx"`,
      "cache-control": "private, no-store",
    },
  });
}
