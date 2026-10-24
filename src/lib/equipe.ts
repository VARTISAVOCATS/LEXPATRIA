// Équipe du cabinet : qualité, rôle qui en découle et modes de rémunération (partagé entre le back office et le serveur).

export const QUALITES = {
  ASSOCIE: { libelle: "Associé", role: "ASSOCIE" },
  COLLABORATEUR: { libelle: "Collaborateur", role: "AVOCAT" },
  SOUS_TRAITANT: { libelle: "Sous-traitant", role: "AVOCAT" },
  SECRETARIAT: { libelle: "Secrétariat juridique", role: "SECRETARIAT" },
  CONFRERE_LOCAL: { libelle: "Confrère local (plaidoirie hors Île-de-France)", role: "CONFRERE_LOCAL" },
} as const;
export type Qualite = keyof typeof QUALITES;
export const CODES_QUALITE = Object.keys(QUALITES) as Qualite[];

export const MODES_REMUNERATION = {
  AUCUNE: "Aucune rémunération sur la plateforme",
  COLLABORATEUR_FIXE_VARIABLE: "Fixe mensuel, puis pourcentage au-delà d'un seuil",
  A_L_ACTE: "Rétrocession par acte et par avis",
} as const;
export type ModeRemuneration = keyof typeof MODES_REMUNERATION;

/** Mode proposé par défaut selon la qualité (modifiable). */
export const MODE_PAR_DEFAUT: Record<Qualite, ModeRemuneration> = {
  ASSOCIE: "AUCUNE",
  COLLABORATEUR: "COLLABORATEUR_FIXE_VARIABLE",
  SOUS_TRAITANT: "A_L_ACTE",
  SECRETARIAT: "AUCUNE",
  CONFRERE_LOCAL: "A_L_ACTE",
};

/** Valeurs du cabinet (centimes HT) : 4 500 € de fixe, 20 % au-delà de 13 500 €, 200 € par acte, 15 € par avis. */
export const VALEURS_CABINET = { fixeMensuelHT: 450_000, seuilVariableHT: 1_350_000, tauxVariable: 0.2, acteHT: 20_000, avisHT: 1_500 };

/** Qualité d'un membre enregistré avant l'ajout de ce champ. */
export function qualiteDe(u: { qualite: string | null; role: string; remuneration: string }): Qualite {
  if (u.qualite && u.qualite in QUALITES) return u.qualite as Qualite;
  if (u.role === "ASSOCIE" || u.role === "SECRETARIAT" || u.role === "CONFRERE_LOCAL") return u.role as Qualite;
  return u.remuneration === "A_L_ACTE" ? "SOUS_TRAITANT" : "COLLABORATEUR";
}
