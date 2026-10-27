// Lecture et écriture des paramètres du back office, avec historique complet et retour arrière.
// Toute écriture : validation du format, filtre déontologique, historique, journal inaltérable.

import { desc, eq, inArray } from "drizzle-orm";
import type { Base } from "@/db";
import { parametres, parametresHistorique } from "@/db/schema";
import { controlerTexte, type Infraction } from "@/lib/deontologie";
import { journaliser } from "@/lib/journal";
import { configPublique } from "./connexions";
import { conventionsActives } from "./modeles-cabinet";
import { CLES_PARAMETRES, PARAMETRES, textesDe, type CleParametre, type ContenusPublics, type ValeurParametre } from "@/lib/parametres";

// Petit cache mémoire : les pages publiques ne relisent la base qu'une fois toutes les 30 secondes.
let cache: { le: number; valeurs: Partial<Record<CleParametre, unknown>> } | null = null;
const DUREE_CACHE = 30_000;

export function viderCache() {
  cache = null;
}

async function toutes(d: Base): Promise<Partial<Record<CleParametre, unknown>>> {
  if (cache && Date.now() - cache.le < DUREE_CACHE) return cache.valeurs;
  const lignes = await d.select().from(parametres).where(inArray(parametres.cle, CLES_PARAMETRES));
  const valeurs: Partial<Record<CleParametre, unknown>> = {};
  for (const l of lignes) {
    const def = PARAMETRES[l.cle as CleParametre];
    const ok = def.schema.safeParse(l.valeur);
    if (ok.success) valeurs[l.cle as CleParametre] = ok.data; // valeur invalide : repli sur la valeur par défaut
  }
  cache = { le: Date.now(), valeurs };
  return valeurs;
}

export async function lireParametre<K extends CleParametre>(d: Base, cle: K): Promise<ValeurParametre<K>> {
  const v = (await toutes(d))[cle];
  return (v ?? PARAMETRES[cle].defaut) as ValeurParametre<K>;
}

export async function contenusPublics(d: Base): Promise<ContenusPublics> {
  const [tarifs, faq, avocats, accueil, echeancier] = await Promise.all([
    lireParametre(d, "tarifs"),
    lireParametre(d, "faq"),
    lireParametre(d, "avocats"),
    lireParametre(d, "accueil"),
    lireParametre(d, "echeancier"),
  ]);
  return { config: await configPublique(), tarifs, faq, avocats, accueil, echeancier: echeancier as ContenusPublics["echeancier"], conventions: await conventionsActives(d) };
}

export interface ControleEcriture {
  ok: boolean;
  erreurs: string[];
  infractions: Infraction[];
  valeur?: unknown;
}

/** Vérifie une valeur sans l'enregistrer (aperçu, propositions de l'assistant). */
export function controler(cle: string, valeur: unknown): ControleEcriture {
  if (!(cle in PARAMETRES)) return { ok: false, erreurs: [`Paramètre inconnu : ${cle}`], infractions: [] };
  const def = PARAMETRES[cle as CleParametre];
  const r = def.schema.safeParse(valeur);
  if (!r.success) {
    return { ok: false, erreurs: r.error.issues.map((i) => `${i.path.join(".") || cle} : ${i.message}`), infractions: [] };
  }
  const infractions = textesDe(r.data).flatMap(controlerTexte);
  return { ok: infractions.length === 0, erreurs: [], infractions, valeur: r.data };
}

export async function ecrireParametre(
  d: Base,
  cle: CleParametre,
  valeur: unknown,
  par: string,
  opts: { origine?: "MANUEL" | "ASSISTANT" | "RETOUR_ARRIERE"; motif?: string } = {},
): Promise<ControleEcriture> {
  const c = controler(cle, valeur);
  if (!c.ok) return c;
  const [avant] = await d.select().from(parametres).where(eq(parametres.cle, cle));
  const le = new Date();
  await d
    .insert(parametres)
    .values({ cle, valeur: c.valeur, majPar: par, majLe: le })
    .onConflictDoUpdate({ target: parametres.cle, set: { valeur: c.valeur, majPar: par, majLe: le } });
  await d.insert(parametresHistorique).values({
    cle,
    avant: avant?.valeur ?? null,
    apres: c.valeur,
    majPar: par,
    origine: opts.origine ?? "MANUEL",
    motif: opts.motif ?? null,
  });
  await journaliser(d, { acteur: par, action: "PARAMETRE_MODIFIE", details: { cle, origine: opts.origine ?? "MANUEL" } });
  viderCache();
  return c;
}

export async function historique(d: Base, cle?: CleParametre, limite = 50) {
  const q = d.select().from(parametresHistorique);
  return (cle ? q.where(eq(parametresHistorique.cle, cle)) : q).orderBy(desc(parametresHistorique.le)).limit(limite);
}

/** Rétablit la valeur qui précédait une modification (valeur par défaut si elle n'existait pas). */
export async function restaurer(d: Base, historiqueId: string, par: string): Promise<ControleEcriture> {
  const [h] = await d.select().from(parametresHistorique).where(eq(parametresHistorique.id, historiqueId));
  if (!h) return { ok: false, erreurs: ["Modification introuvable."], infractions: [] };
  const cle = h.cle as CleParametre;
  const cible = h.avant ?? PARAMETRES[cle].defaut;
  return ecrireParametre(d, cle, cible, par, { origine: "RETOUR_ARRIERE", motif: `Retour à l'état précédant la modification ${h.id}` });
}
