// Téléchargement d'un acte pour Word (format RTF) : les mentions XXX sont surlignées en jaune.
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { journaliser } from "@/lib/journal";
import { voitTout } from "@/lib/serveur/dossiers";
import { membreConnecte } from "@/lib/serveur/session";

function rtf(texte: string): string {
  const echapper = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\{/g, "\\{")
      .replace(/\}/g, "\\}")
      .replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0) > 32767 ? c.charCodeAt(0) - 65536 : c.charCodeAt(0)}?`);
  const corps = texte
    .split("\n")
    .map((ligne) =>
      ligne
        .split(/(XXX)/)
        .map((morceau) => (morceau === "XXX" ? "{\\highlight1\\b XXX}" : echapper(morceau)))
        .join(""),
    )
    .map((l) => `${l}\\par`)
    .join("\n");
  return `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0 Times New Roman;}}{\\colortbl;\\red255\\green255\\blue0;}\\f0\\fs24\\sl276\\slmult1\n${corps}\n}`;
}

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
  return new Response(rtf(acte.contenu), {
    headers: {
      "content-type": "application/rtf",
      "content-disposition": `attachment; filename="${dos.reference}-${acte.type}-v${acte.version}.rtf"`,
      "cache-control": "private, no-store",
    },
  });
}
