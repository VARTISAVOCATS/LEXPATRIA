// Modèles d'actes du cabinet, déposés et modifiés au back office par les associés.
// Chaque enregistrement est une version (historique, retour arrière) ; la plus récente s'applique aux nouveaux projets.
// Un projet déjà généré n'est jamais modifié par un changement de modèle.

import { and, desc, eq, inArray } from "drizzle-orm";
import type { Base } from "@/db";
import { modelesCabinet } from "@/db/schema";
import { journaliser } from "@/lib/journal";
import { CODES_CONVENTION, estCodeConvention, LIBELLES_CONVENTION, variablesConventionInconnues, type ModelesConvention } from "@/lib/convention";
import { LIBELLES_MODELE, variablesInconnues, type CodeModele } from "@/lib/modeles";
import type { Membre } from "./session";

export const estCode = (c: string): c is CodeModele => c in LIBELLES_MODELE;

/** Texte du modèle du cabinet en vigueur pour ce type d'acte, ou null (modèle intégré). */
export async function modeleActif(d: Base, code: CodeModele): Promise<string | null> {
  const [m] = await d.select().from(modelesCabinet).where(eq(modelesCabinet.code, code)).orderBy(desc(modelesCabinet.version)).limit(1);
  return m && m.texte.trim() ? m.texte : null;
}

export async function etatModeles(d: Base, libelles: Record<string, string> = LIBELLES_MODELE) {
  const toutes = await d.select().from(modelesCabinet).orderBy(desc(modelesCabinet.version));
  return Object.keys(libelles).map((code) => {
    const versions = toutes.filter((x) => x.code === code);
    const actuel = versions[0];
    return { code, libelle: libelles[code], cabinet: !!actuel?.texte.trim(), actuel: actuel ?? null, versions };
  });
}

export const etatConventions = (d: Base) => etatModeles(d, LIBELLES_CONVENTION);

/** Modèles de convention du cabinet en vigueur (texte et numéro de version), par type de convention. */
export async function conventionsActives(d: Base): Promise<ModelesConvention> {
  const toutes = await d.select().from(modelesCabinet).where(inArray(modelesCabinet.code, CODES_CONVENTION)).orderBy(desc(modelesCabinet.version));
  const r: ModelesConvention = {};
  for (const code of CODES_CONVENTION) {
    const m = toutes.find((x) => x.code === code);
    r[code] = m && m.texte.trim() ? { texte: m.texte, version: m.version } : null;
  }
  return r;
}

export async function enregistrerModele(d: Base, m: Membre, code: string, texte: string, fichier?: string | null) {
  if (m.role !== "ASSOCIE") return { ok: false as const, erreur: "Réservé aux associés." };
  const convention = estCodeConvention(code);
  if (!estCode(code) && !convention) return { ok: false as const, erreur: "Type de modèle inconnu." };
  const t = texte.replace(/\r\n/g, "\n").slice(0, 200_000);
  const inconnues = convention ? variablesConventionInconnues(t) : variablesInconnues(t);
  if (inconnues.length) return { ok: false as const, erreur: `Variable(s) inconnue(s) : ${inconnues.map((x) => `{{${x}}}`).join(", ")}.` };
  const [dernier] = await d.select().from(modelesCabinet).where(eq(modelesCabinet.code, code)).orderBy(desc(modelesCabinet.version)).limit(1);
  if (dernier && dernier.texte === t) return { ok: false as const, erreur: "Aucune modification." };
  const version = (dernier?.version ?? 0) + 1;
  await d.insert(modelesCabinet).values({ code, version, texte: t, fichier: fichier ?? null, auteurId: m.id });
  await journaliser(d, { acteur: m.id, action: t.trim() ? "MODELE_ENREGISTRE" : "MODELE_INTEGRE_RETABLI", details: { code, version, fichier: fichier ?? null } });
  return { ok: true as const, version };
}

/** Retour à une version antérieure : elle est recopiée comme nouvelle version (l'historique reste complet). */
export async function restaurerModele(d: Base, m: Membre, id: string) {
  const [v] = await d.select().from(modelesCabinet).where(eq(modelesCabinet.id, id));
  if (!v) return { ok: false as const, erreur: "Version introuvable." };
  return enregistrerModele(d, m, v.code, v.texte, v.fichier);
}

export async function versionModele(d: Base, code: CodeModele, version: number) {
  const [v] = await d.select().from(modelesCabinet).where(and(eq(modelesCabinet.code, code), eq(modelesCabinet.version, version)));
  return v ?? null;
}

/** Texte d'un fichier Word (.docx). Les « XXX » et les variables {{…}} saisis dans Word sont conservés. */
export async function texteDocx(donnees: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const r = await mammoth.extractRawText({ buffer: donnees });
  return r.value.replace(/\n{3,}/g, "\n\n").trim();
}
