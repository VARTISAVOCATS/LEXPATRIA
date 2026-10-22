// Catalogue des procédures et grille tarifaire par défaut (cahier des charges, sections 4 et 13).
// Les valeurs ci-dessous sont les valeurs initiales : en production, elles sont lues dans
// les paramètres du back office (table Parametre) et ce fichier ne sert que de repli.

export type CodeProcedure =
  | "OQTF"
  | "REFUS_TITRE"
  | "REFUS_VISA"
  | "NATURALISATION"
  | "REFUS_IMPLICITE"
  | "BLOCAGE_EMPLOI"
  | "BLOCAGE_SIMPLE"
  | "PROCEDURE_EN_COURS"
  | "DIAGNOSTIC"
  | "CONSULTATION";

export type Diligence =
  | "REQUETE"
  | "REFERE_SUSPENSION_AVEC_REQUETE"
  | "REFERE_SUSPENSION_SEUL"
  | "REFERE_LIBERTE"
  | "REFERE_MESURES_UTILES"
  | "RAPO"
  | "RECOURS_GRACIEUX"
  | "MISE_EN_DEMEURE"
  | "AVIS_PREALABLE"
  | "DIAGNOSTIC"
  | "CONSULTATION"
  | "MAJORATION_URGENCE"
  | "APPEL";

/** Prix TTC en centimes. */
export const TARIFS_DEFAUT: Record<Diligence, number> = {
  REQUETE: 99_000,
  REFERE_SUSPENSION_AVEC_REQUETE: 49_000,
  REFERE_SUSPENSION_SEUL: 99_000,
  REFERE_LIBERTE: 99_000,
  REFERE_MESURES_UTILES: 99_000,
  RAPO: 45_000,
  RECOURS_GRACIEUX: 35_000,
  MISE_EN_DEMEURE: 15_000,
  AVIS_PREALABLE: 6_900,
  DIAGNOSTIC: 6_900,
  CONSULTATION: 8_900,
  MAJORATION_URGENCE: 19_000,
  APPEL: 129_000,
};

/** Retenue en cas de remboursement pour délai dépassé (prix de l'avis). */
export const RETENUE_REMBOURSEMENT = 6_900;

export interface Procedure {
  code: CodeProcedure;
  libelle: string;
  /** Diligence facturée par défaut quand la procédure est engagée. */
  diligence: Diligence;
  /** Le paiement en ligne est-il ouvert pour cette procédure ? */
  enLigne: boolean;
}

export const PROCEDURES: Record<CodeProcedure, Procedure> = {
  OQTF: { code: "OQTF", libelle: "Recours contre une OQTF", diligence: "REQUETE", enLigne: true },
  REFUS_TITRE: {
    code: "REFUS_TITRE",
    libelle: "Recours contre un refus de titre de séjour",
    diligence: "REQUETE",
    enLigne: true,
  },
  REFUS_VISA: {
    code: "REFUS_VISA",
    libelle: "Recours préalable contre un refus de visa",
    diligence: "RAPO",
    enLigne: true,
  },
  NATURALISATION: {
    code: "NATURALISATION",
    libelle: "Recours préalable contre un refus ou un ajournement de naturalisation",
    diligence: "RAPO",
    enLigne: true,
  },
  REFUS_IMPLICITE: {
    code: "REFUS_IMPLICITE",
    libelle: "Recours contre le refus implicite de la préfecture",
    diligence: "REQUETE",
    enLigne: true,
  },
  BLOCAGE_EMPLOI: {
    code: "BLOCAGE_EMPLOI",
    libelle: "Référé devant le tribunal administratif",
    diligence: "REFERE_LIBERTE",
    enLigne: true,
  },
  BLOCAGE_SIMPLE: {
    code: "BLOCAGE_SIMPLE",
    libelle: "Mise en demeure de la préfecture",
    diligence: "MISE_EN_DEMEURE",
    enLigne: true,
  },
  PROCEDURE_EN_COURS: {
    code: "PROCEDURE_EN_COURS",
    libelle: "Reprise d'une procédure en cours",
    diligence: "REQUETE",
    enLigne: true,
  },
  DIAGNOSTIC: { code: "DIAGNOSTIC", libelle: "Diagnostic écrit de votre situation", diligence: "DIAGNOSTIC", enLigne: true },
  CONSULTATION: { code: "CONSULTATION", libelle: "Consultation en visio avec un avocat", diligence: "CONSULTATION", enLigne: true },
};

/** Durée d'une consultation en visio (minutes). */
export const DUREE_CONSULTATION_MIN = 30;

export function prixTTC(d: Diligence, tarifs: Record<Diligence, number> = TARIFS_DEFAUT): number {
  return tarifs[d];
}

/** Échéancier du paiement en trois fois (affichage) : arrondi à l'euro, le reste sur la première échéance. */
export function troisFois(totalCentimes: number): [number, number, number] {
  const base = Math.floor(totalCentimes / 3 / 100) * 100;
  return [totalCentimes - 2 * base, base, base];
}

export function formatEuros(centimes: number): string {
  const euros = centimes / 100;
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: Number.isInteger(euros) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(euros) + " €"
  );
}

export const LIBELLES_DILIGENCE: Record<Diligence, string> = {
  REQUETE: "Requête devant le tribunal administratif (mémoires et plaidoirie compris)",
  REFERE_SUSPENSION_AVEC_REQUETE: "Référé-suspension, engagé avec la requête",
  REFERE_SUSPENSION_SEUL: "Référé-suspension",
  REFERE_LIBERTE: "Référé-liberté ou référé mesures utiles, au choix de l'avocat",
  REFERE_MESURES_UTILES: "Référé mesures utiles ou référé-liberté, au choix de l'avocat",
  RAPO: "Recours administratif préalable",
  RECOURS_GRACIEUX: "Recours gracieux",
  MISE_EN_DEMEURE: "Mise en demeure de la préfecture",
  AVIS_PREALABLE: "Avis écrit d'un avocat",
  DIAGNOSTIC: "Diagnostic écrit de votre situation",
  CONSULTATION: "Consultation en visio avec un avocat (30 minutes)",
  MAJORATION_URGENCE: "Prise en charge en urgence (requête sommaire, sous 10 heures ouvrées)",
  APPEL: "Appel devant la cour administrative d'appel",
};

export function libelleDiligence(d: Diligence): string {
  return LIBELLES_DILIGENCE[d];
}

/** Lignes d'honoraires de l'offre « Votre recours » (ou de l'avis préalable). */
export function composerOffre(
  code: CodeProcedure,
  opts: { urgence: boolean; avisPrealable?: boolean },
  tarifs: Record<Diligence, number> = TARIFS_DEFAUT,
): { diligence: Diligence; libelle: string; montant: number }[] {
  const ligne = (d: Diligence) => ({ diligence: d, libelle: LIBELLES_DILIGENCE[d], montant: tarifs[d] });
  if (opts.avisPrealable) return [ligne("AVIS_PREALABLE")];
  const lignes = [ligne(PROCEDURES[code].diligence)];
  if (opts.urgence && PROCEDURES[code].diligence !== "DIAGNOSTIC") lignes.push(ligne("MAJORATION_URGENCE"));
  return lignes;
}

/** Recours préalables : la mission s'achève à la réponse de l'administration. */
export function estRecoursPrealable(code: CodeProcedure): boolean {
  return PROCEDURES[code].diligence === "RAPO";
}
