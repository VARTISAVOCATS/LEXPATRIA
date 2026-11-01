// Qualifications rédigées par l'IA hors référentiel : regroupées par libellé pour le back office,
// puis ajoutées au référentiel par un associé (ou écartées). Aucune donnée du client n'y figure.
import { desc, eq, inArray } from "drizzle-orm";
import type { Base } from "@/db";
import { casLibres } from "@/db/schema";
import { casDepuisLibre, schemaCasLibre, type Cas } from "@/lib/cas";
import { ecrireParametre, lireParametre } from "./parametres";

const cle = (libelle: string) => libelle.trim().toLowerCase().replace(/\s+/g, " ");

export interface GroupeCasLibre {
  ids: string[];
  libelle: string;
  nombre: number;
  dernier: Date;
  fiche: ReturnType<typeof casDepuisLibre>;
}

export async function casLibresEnAttente(d: Base): Promise<GroupeCasLibre[]> {
  const lignes = await d.select().from(casLibres).where(eq(casLibres.traite, false)).orderBy(desc(casLibres.creeLe)).limit(500);
  const groupes = new Map<string, GroupeCasLibre>();
  for (const l of lignes) {
    const f = schemaCasLibre.safeParse(l.fiche);
    if (!f.success) continue;
    const k = cle(l.libelle);
    const g = groupes.get(k);
    if (g) {
      g.ids.push(l.id);
      g.nombre++;
    } else groupes.set(k, { ids: [l.id], libelle: l.libelle, nombre: 1, dernier: l.creeLe, fiche: casDepuisLibre(f.data) });
  }
  return [...groupes.values()].sort((a, b) => b.nombre - a.nombre || b.dernier.getTime() - a.dernier.getTime());
}

function codeLibre(libelle: string, existants: Set<string>): string {
  const base =
    libelle
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 34) || "CAS";
  let code = base;
  for (let i = 2; existants.has(code); i++) code = `${base.slice(0, 34)}_${i}`;
  return code;
}

/** Ajoute la fiche d'un groupe au référentiel en vigueur et marque le groupe comme traité. */
export async function ajouterAuReferentiel(d: Base, id: string, par: string): Promise<{ ok: true; code: string } | { ok: false; erreur: string }> {
  const groupe = (await casLibresEnAttente(d)).find((g) => g.ids.includes(id));
  if (!groupe) return { ok: false, erreur: "Cas introuvable ou déjà traité." };
  const referentiel = await lireParametre(d, "cas");
  const code = codeLibre(groupe.libelle, new Set(referentiel.map((c) => c.code)));
  const fiche: Cas = { ...groupe.fiche, code, signes: groupe.fiche.signes.length >= 10 ? groupe.fiche.signes : `${groupe.libelle}.` };
  const r = await ecrireParametre(d, "cas", [...referentiel, fiche], par, { motif: `Cas ajouté depuis les qualifications hors référentiel : ${groupe.libelle}` });
  if (!r.ok) return { ok: false, erreur: [...r.erreurs, ...r.infractions.map((i) => `Terme interdit « ${i.motif} »`)].join(" ; ") };
  await d.update(casLibres).set({ traite: true }).where(inArray(casLibres.id, groupe.ids));
  return { ok: true, code };
}

export async function ecarter(d: Base, id: string): Promise<void> {
  const groupe = (await casLibresEnAttente(d)).find((g) => g.ids.includes(id));
  if (groupe) await d.update(casLibres).set({ traite: true }).where(inArray(casLibres.id, groupe.ids));
}
