// Étapes d'un dossier, telles que le client et le cabinet les voient.
import { PROCEDURES, type CodeProcedure } from "./procedures";

export type Statut =
  | "PRE_DOSSIER"
  | "ATTENTE_PROCHE"
  | "APPEL_PROPOSE"
  | "PAYE"
  | "PRIS_EN_CHARGE"
  | "EN_REDACTION"
  | "ACTE_ATTESTE"
  | "DEPOSE"
  | "ENREGISTRE"
  | "INSTRUCTION"
  | "AUDIENCE"
  | "JUGE"
  | "CLOS"
  | "CLOS_REMBOURSE";

export const LIBELLES_STATUT: Record<Statut, string> = {
  PRE_DOSSIER: "Dépôt non terminé",
  ATTENTE_PROCHE: "En attente du règlement par un proche",
  APPEL_PROPOSE: "Appel proposé par votre avocat",
  PAYE: "Dossier reçu",
  PRIS_EN_CHARGE: "Pris en charge par votre avocat",
  EN_REDACTION: "Rédaction en cours",
  ACTE_ATTESTE: "Acte vérifié et signé par votre avocat",
  DEPOSE: "Recours déposé",
  ENREGISTRE: "Recours enregistré",
  INSTRUCTION: "Instruction en cours",
  AUDIENCE: "Audience fixée",
  JUGE: "Décision rendue",
  CLOS: "Dossier terminé",
  CLOS_REMBOURSE: "Dossier clos et remboursé",
};

/** Étapes affichées dans le suivi, dans l'ordre. Recours préalable (visa, naturalisation) : pas de tribunal. */
export function etapesSuivi(procedure: string): Statut[] {
  const prealable = PROCEDURES[procedure as CodeProcedure]?.diligence === "RAPO" || procedure === "BLOCAGE_SIMPLE" || procedure === "DIAGNOSTIC";
  return prealable
    ? ["PAYE", "PRIS_EN_CHARGE", "EN_REDACTION", "ACTE_ATTESTE", "DEPOSE", "CLOS"]
    : ["PAYE", "PRIS_EN_CHARGE", "EN_REDACTION", "ACTE_ATTESTE", "DEPOSE", "ENREGISTRE", "INSTRUCTION", "AUDIENCE", "JUGE", "CLOS"];
}

export const ORDRE_STATUTS: Statut[] = [
  "PRE_DOSSIER",
  "ATTENTE_PROCHE",
  "APPEL_PROPOSE",
  "PAYE",
  "PRIS_EN_CHARGE",
  "EN_REDACTION",
  "ACTE_ATTESTE",
  "DEPOSE",
  "ENREGISTRE",
  "INSTRUCTION",
  "AUDIENCE",
  "JUGE",
  "CLOS",
  "CLOS_REMBOURSE",
];

/** Une procédure juridictionnelle (passée devant le tribunal) peut donner lieu à un appel. */
export const peutFaireAppel = (procedure: string) => etapesSuivi(procedure).includes("JUGE");

export const rang = (s: string) => ORDRE_STATUTS.indexOf(s as Statut);

/** Statuts que l'avocat peut choisir lui-même (ACTE_ATTESTE passe par l'attestation). */
export const STATUTS_AVOCAT: Statut[] = ["PRIS_EN_CHARGE", "EN_REDACTION", "DEPOSE", "ENREGISTRE", "INSTRUCTION", "AUDIENCE", "JUGE", "CLOS"];

export const ONGLETS_A_PRENDRE = ["PAYE"] as const;
export const STATUTS_TERMINES = ["CLOS", "CLOS_REMBOURSE"] as const;

export function frDate(iso?: string | null): string {
  if (!iso) return "";
  const [a, m, j] = iso.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
}

export function frDateHeure(d?: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }).format(d);
}
