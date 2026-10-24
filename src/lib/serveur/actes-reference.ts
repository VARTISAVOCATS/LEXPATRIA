// Actes de référence du cabinet : actes déjà rédigés, déposés au back office (Word, PDF ou texte) pour que l'IA
// en reprenne la structure, le style et les moyens lorsqu'elle prépare un projet du même type.
// Les faits et les données d'un ancien client ne doivent jamais être repris : masquage automatique des identifiants
// à l'import, puis relecture par l'associé avant enregistrement ; consigne explicite au modèle lors de la génération.

import { and, desc, eq } from "drizzle-orm";
import type { Base } from "@/db";
import { actesReference } from "@/db/schema";
import { journaliser } from "@/lib/journal";
import { minimiser } from "@/lib/triage";
import { estCode, texteDocx } from "./modeles-cabinet";
import type { Membre } from "./session";

const MAX_TEXTE = 120_000;
/** Longueur reprise par acte de référence dans la consigne de génération. */
const EXTRAIT = 14_000;

/** Masque les identifiants repérables (e-mails, téléphones, numéros d'étranger, passeports, dates de naissance). */
export function masquer(texte: string): string {
  return minimiser(texte)
    .replace(/\b(n[ée]e?\s+le)\s+\d{1,2}(?:er)?[\s./-]+(?:\d{1,2}|[a-zéû]+)[\s./-]+\d{2,4}/gi, "$1 XXX")
    .replace(/\[(?:e-mail|téléphone|numéro)\]/g, "XXX");
}

/** Texte d'un fichier importé (.docx, .pdf ou .txt), déjà masqué. */
export async function texteFichier(nom: string, donnees: Buffer): Promise<string> {
  let brut: string;
  if (/\.docx$/i.test(nom)) brut = await texteDocx(donnees);
  else if (/\.pdf$/i.test(nom)) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const { text } = await extractText(await getDocumentProxy(new Uint8Array(donnees)), { mergePages: true });
    brut = String(text);
  } else brut = donnees.toString("utf8");
  return masquer(brut.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()).slice(0, MAX_TEXTE);
}

export const actesReferenceListe = (d: Base) => d.select().from(actesReference).orderBy(desc(actesReference.creeLe));

type Resultat = { ok: true } | { ok: false; erreur: string };

export async function ajouterActeReference(d: Base, m: Membre, x: { code: string; titre: string; texte: string; fichier?: string | null }): Promise<Resultat> {
  if (m.role !== "ASSOCIE") return { ok: false, erreur: "Réservé aux associés." };
  if (!estCode(x.code)) return { ok: false, erreur: "Type d'acte inconnu." };
  const texte = x.texte.replace(/\r\n/g, "\n").trim().slice(0, MAX_TEXTE);
  if (texte.length < 300) return { ok: false, erreur: "Texte trop court pour servir de référence (300 caractères au moins)." };
  await d.insert(actesReference).values({ code: x.code, titre: x.titre.trim().slice(0, 160) || "Acte de référence", texte, fichier: x.fichier ?? null, auteurId: m.id });
  await journaliser(d, { acteur: m.id, action: "ACTE_REFERENCE_AJOUTE", details: { code: x.code, fichier: x.fichier ?? null } });
  return { ok: true };
}

export async function activerActeReference(d: Base, m: Membre, id: string, actif: boolean): Promise<Resultat> {
  if (m.role !== "ASSOCIE") return { ok: false, erreur: "Réservé aux associés." };
  const r = await d.update(actesReference).set({ actif }).where(eq(actesReference.id, id)).returning({ code: actesReference.code });
  if (!r.length) return { ok: false, erreur: "Acte introuvable." };
  await journaliser(d, { acteur: m.id, action: actif ? "ACTE_REFERENCE_ACTIVE" : "ACTE_REFERENCE_RETIRE", details: { id } });
  return { ok: true };
}

export async function supprimerActeReference(d: Base, m: Membre, id: string): Promise<Resultat> {
  if (m.role !== "ASSOCIE") return { ok: false, erreur: "Réservé aux associés." };
  const r = await d.delete(actesReference).where(eq(actesReference.id, id)).returning({ code: actesReference.code });
  if (!r.length) return { ok: false, erreur: "Acte introuvable." };
  await journaliser(d, { acteur: m.id, action: "ACTE_REFERENCE_SUPPRIME", details: { id, code: r[0].code } });
  return { ok: true };
}

/** Actes de référence actifs pour ce type d'acte (les deux plus récents), en extraits, pour la consigne de génération. */
export async function referencesPour(d: Base, code: string): Promise<{ titre: string; texte: string }[]> {
  const liste = await d
    .select({ titre: actesReference.titre, texte: actesReference.texte })
    .from(actesReference)
    .where(and(eq(actesReference.code, code), eq(actesReference.actif, true)))
    .orderBy(desc(actesReference.creeLe))
    .limit(2);
  return liste.map((x) => ({ titre: x.titre, texte: x.texte.slice(0, EXTRAIT) }));
}
