// Journal inaltérable du dossier : chaque entrée porte l'empreinte SHA-256 de son contenu
// et de l'empreinte de l'entrée précédente du même dossier. Toute altération rompt la chaîne.

import { createHash } from "node:crypto";
import { desc, eq, isNull } from "drizzle-orm";
import type { Base } from "@/db";
import { journal } from "@/db/schema";

export async function journaliser(
  d: Base,
  e: { dossierId?: string; acteur: string; action: string; details?: unknown },
): Promise<void> {
  const derniere = await d
    .select({ empreinte: journal.empreinte })
    .from(journal)
    .where(e.dossierId ? eq(journal.dossierId, e.dossierId) : isNull(journal.dossierId))
    .orderBy(desc(journal.le))
    .limit(1);
  const precedente = derniere[0]?.empreinte ?? null;
  const le = new Date();
  const empreinte = createHash("sha256")
    .update(JSON.stringify([precedente, e.dossierId ?? null, e.acteur, e.action, e.details ?? null, le.toISOString()]))
    .digest("hex");
  await d.insert(journal).values({
    dossierId: e.dossierId,
    acteur: e.acteur,
    action: e.action,
    details: e.details ?? null,
    empreinte,
    precedente,
    le,
  });
}

export function empreinteTexte(texte: string): string {
  return createHash("sha256").update(texte, "utf8").digest("hex");
}
