// Lot 3, étape 3 : indicateurs du cabinet (réservés aux associés).
// Volume et honoraires, prise en charge sous 48 heures ouvrées, délais jusqu'au dépôt, répartition par procédure
// et par avocat, base de rémunération des collaborateurs. Calculs en mémoire : les volumes restent modestes.

import { and, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { Base } from "@/db";
import { actes, attestations, dossiers, journal, paiements, utilisateurs } from "@/db/schema";
import { echeanceAvis, jourParis } from "./agenda";
import { lireParametre } from "./parametres";

export type Periode = "30" | "90" | "365" | "annee";
export const PERIODES: [Periode, string][] = [
  ["30", "30 derniers jours"],
  ["90", "3 derniers mois"],
  ["365", "12 derniers mois"],
  ["annee", "Année en cours"],
];

export function debutPeriode(p: Periode, maintenant = new Date()): Date {
  if (p === "annee") return new Date(`${jourParis(maintenant).slice(0, 4)}-01-01T00:00:00+01:00`);
  return new Date(maintenant.getTime() - Number(p) * 86_400_000);
}

const HT = (ttc: number) => Math.round(ttc / 1.2);
const moyenne = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export interface LigneAvocat {
  id: string;
  nom: string;
  role: string;
  recus: number;
  acceptesSous48h: number;
  acceptes: number;
  actesAttestes: number;
  avisTransmis: number;
  motsModifiesMoyen: number | null;
  revueMoyenneMin: number | null;
  baseHT: number; // honoraires HT des dossiers dont l'acte a été attesté sur la période
  variableHT: number | null; // part variable estimée (collaborateur : taux au-delà du seuil)
  actesRemunerables: number; // actes distincts attestés (un par dossier et par type d'acte, hors avis écrits)
  montantActesHT: number | null; // rétrocession à l'acte (avocats rémunérés à l'acte)
  mode: string;
}

export async function indicateurs(d: Base, periode: Periode, maintenant = new Date()) {
  const debut = debutPeriode(periode, maintenant);

  // Paiements de la période (premier paiement réglé de chaque dossier).
  const pay = await d
    .select({ p: paiements, dos: dossiers })
    .from(paiements)
    .innerJoin(dossiers, eq(dossiers.id, paiements.dossierId))
    .where(and(gte(paiements.creeLe, debut), inArray(paiements.statut, ["PAYE", "REMBOURSE", "PARTIEL"])));
  const encaisse = pay.reduce((s, x) => s + x.p.montant - (x.p.rembourseMontant ?? 0), 0);
  const rembourses = pay.filter((x) => x.p.statut !== "PAYE").length;
  const premierPaiement = new Map<string, Date>();
  for (const x of pay) {
    const v = premierPaiement.get(x.dos.id);
    if (!v || x.p.creeLe < v) premierPaiement.set(x.dos.id, x.p.creeLe);
  }
  const dossiersPayes = [...new Map(pay.map((x) => [x.dos.id, x.dos])).values()];

  // Prise en charge sous 48 heures ouvrées.
  const acceptes = dossiersPayes.filter((x) => x.accepteLe);
  const sous48 = acceptes.filter((x) => x.accepteLe! <= echeanceAvis(premierPaiement.get(x.id)!));
  const delaiAcceptationH = moyenne(acceptes.map((x) => (x.accepteLe!.getTime() - premierPaiement.get(x.id)!.getTime()) / 3_600_000));

  // Dépôts : date du passage au statut « déposé » (journal).
  const depots = await d
    .select({ dossierId: journal.dossierId, le: journal.le })
    .from(journal)
    .where(and(eq(journal.action, "STATUT_MODIFIE"), sql`${journal.details}->>'vers' = 'DEPOSE'`, gte(journal.le, debut)));
  const deposeLe = new Map<string, Date>();
  for (const x of depots) if (x.dossierId && (!deposeLe.has(x.dossierId) || x.le < deposeLe.get(x.dossierId)!)) deposeLe.set(x.dossierId, x.le);
  const dossiersDeposes = deposeLe.size ? await d.select().from(dossiers).where(inArray(dossiers.id, [...deposeLe.keys()])) : [];
  const horsDelai = dossiersDeposes.filter((x) => x.dateLimite && jourParis(deposeLe.get(x.id)!) > x.dateLimite).length;
  const delaiDepotJ = moyenne(
    dossiersDeposes.filter((x) => premierPaiement.has(x.id)).map((x) => (deposeLe.get(x.id)!.getTime() - premierPaiement.get(x.id)!.getTime()) / 86_400_000),
  );

  // Alerte : date limite passée sans dépôt (hors consultations).
  const aujourdhui = jourParis(maintenant);
  const enSouffrance = await d
    .select({ reference: dossiers.reference, dateLimite: dossiers.dateLimite })
    .from(dossiers)
    .where(
      and(
        inArray(dossiers.statut, ["PAYE", "PRIS_EN_CHARGE", "EN_REDACTION", "ACTE_ATTESTE"]),
        eq(dossiers.avisPrealable, false),
        sql`${dossiers.procedure} <> 'DIAGNOSTIC'`,
        isNotNull(dossiers.dateLimite),
        sql`${dossiers.dateLimite} < ${aujourdhui}`,
      ),
    );

  // Par procédure.
  const parProcedure = new Map<string, { n: number; montant: number }>();
  for (const x of pay) {
    const cle = x.dos.dossierParentId ? "APPEL" : x.dos.avisPrealable ? "AVIS_PREALABLE" : x.dos.procedure;
    const v = parProcedure.get(cle) ?? { n: 0, montant: 0 };
    if (x.p.statut === "PAYE" && premierPaiement.get(x.dos.id) === x.p.creeLe) v.n++;
    v.montant += x.p.montant - (x.p.rembourseMontant ?? 0);
    parProcedure.set(cle, v);
  }

  // Par avocat.
  const remuneration = await lireParametre(d, "remuneration");
  const equipe = (await d.select().from(utilisateurs)).filter((u) => u.actif && (u.role === "AVOCAT" || u.role === "ASSOCIE"));
  const atts = await d
    .select({ a: attestations, acte: { dossierId: actes.dossierId, type: actes.type, motsModifies: actes.motsModifies, tempsRevueS: actes.tempsRevueS } })
    .from(attestations)
    .innerJoin(actes, eq(actes.id, attestations.acteId))
    .where(gte(attestations.le, debut));
  const avis = await d.select({ avocatId: dossiers.avocatId }).from(dossiers).where(gte(dossiers.avisTransmisLe, debut));
  // Honoraires réglés de chaque dossier (toutes périodes), pour la base de rémunération.
  const idsAttestes = [...new Set(atts.map((x) => x.acte.dossierId))];
  const regles = idsAttestes.length
    ? await d
        .select({ dossierId: paiements.dossierId, montant: sql<number>`sum(${paiements.montant} - coalesce(${paiements.rembourseMontant}, 0))` })
        .from(paiements)
        .where(and(inArray(paiements.dossierId, idsAttestes), inArray(paiements.statut, ["PAYE", "PARTIEL"])))
        .groupBy(paiements.dossierId)
    : [];
  const montantDossier = new Map(regles.map((r) => [r.dossierId, Number(r.montant)]));

  const parAvocat: LigneAvocat[] = equipe.map((u) => {
    const recus = dossiersPayes.filter((x) => x.avocatId === u.id);
    const acc = recus.filter((x) => x.accepteLe);
    const mesAtts = atts.filter((x) => x.a.avocatId === u.id);
    // Un dossier compte une fois dans la base, même si plusieurs versions ou actes ont été attestés.
    const dossiersAttestes = [...new Set(mesAtts.map((x) => x.acte.dossierId))];
    const baseHT = dossiersAttestes.reduce((s, id) => s + HT(montantDossier.get(id) ?? 0), 0);
    const variableHT =
      u.remuneration === "COLLABORATEUR_FIXE_VARIABLE" && u.seuilVariableHT != null && u.tauxVariable != null
        ? Math.max(0, Math.round((baseHT - u.seuilVariableHT) * u.tauxVariable))
        : null;
    // Un acte est rémunéré une fois, à sa première attestation : les nouvelles versions du même acte ne comptent pas.
    const actesRemunerables = new Set(mesAtts.filter((x) => x.acte.type !== "AVIS_ECRIT").map((x) => `${x.acte.dossierId}:${x.acte.type}`)).size;
    return {
      id: u.id,
      nom: `${u.prenom} ${u.nom}`,
      role: u.role,
      recus: recus.length,
      acceptes: acc.length,
      acceptesSous48h: acc.filter((x) => x.accepteLe! <= echeanceAvis(premierPaiement.get(x.id)!)).length,
      actesAttestes: mesAtts.length,
      avisTransmis: avis.filter((x) => x.avocatId === u.id).length,
      motsModifiesMoyen: moyenne(mesAtts.map((x) => x.acte.motsModifies)),
      revueMoyenneMin: moyenne(mesAtts.map((x) => x.acte.tempsRevueS / 60)),
      baseHT,
      variableHT,
      actesRemunerables,
      montantActesHT: u.remuneration === "A_L_ACTE" ? actesRemunerables * remuneration.acteHT : null,
      mode: u.remuneration,
    };
  });

  return {
    debut,
    dossiersPayes: dossiersPayes.length,
    encaisse,
    rembourses,
    tauxSous48h: acceptes.length ? sous48.length / acceptes.length : null,
    acceptes: acceptes.length,
    delaiAcceptationH,
    deposes: dossiersDeposes.length,
    horsDelai,
    delaiDepotJ,
    enSouffrance,
    parProcedure: [...parProcedure.entries()].sort((a, b) => b[1].montant - a[1].montant),
    parAvocat,
    tarifActeHT: remuneration.acteHT,
  };
}
