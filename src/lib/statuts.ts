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

/** Vue du client : les étapes qui le concernent, sans le détail du travail de l'avocat (rédaction, relecture). */
type Genre = "CONTENTIEUX" | "PREALABLE" | "MISE_EN_DEMEURE" | "AVIS" | "CONSULTATION";
function genre(procedure: string): Genre {
  if (procedure === "CONSULTATION") return "CONSULTATION";
  if (procedure === "DIAGNOSTIC") return "AVIS";
  if (procedure === "BLOCAGE_SIMPLE") return "MISE_EN_DEMEURE";
  return PROCEDURES[procedure as CodeProcedure]?.diligence === "RAPO" ? "PREALABLE" : "CONTENTIEUX";
}

export function etapesClient(procedure: string, avisPrealable = false): Statut[] {
  const g = avisPrealable ? "AVIS" : genre(procedure);
  if (g === "CONTENTIEUX") return ["PAYE", "PRIS_EN_CHARGE", "DEPOSE", "ENREGISTRE", "INSTRUCTION", "AUDIENCE", "JUGE", "CLOS"];
  if (g === "PREALABLE" || g === "MISE_EN_DEMEURE") return ["PAYE", "PRIS_EN_CHARGE", "DEPOSE", "CLOS"];
  return ["PAYE", "PRIS_EN_CHARGE", "CLOS"];
}

/** Statut tel que le client le voit : la rédaction et la vérification de l'acte restent « pris en charge ». */
export const statutClient = (s: Statut): Statut => (s === "EN_REDACTION" || s === "ACTE_ATTESTE" ? "PRIS_EN_CHARGE" : s);

export function libelleClient(s: Statut, procedure: string, avisPrealable = false): string {
  const g = avisPrealable ? "AVIS" : genre(procedure);
  switch (statutClient(s)) {
    case "PAYE":
      return "Dossier reçu";
    case "PRIS_EN_CHARGE":
      return g === "CONTENTIEUX" ? "Dossier pris en charge · attestation disponible" : g === "CONSULTATION" ? "Rendez-vous fixé" : "Dossier pris en charge";
    case "DEPOSE":
      return g === "CONTENTIEUX" ? "Recours déposé au tribunal" : g === "MISE_EN_DEMEURE" ? "Mise en demeure envoyée" : "Recours envoyé";
    case "ENREGISTRE":
      return "Recours enregistré par le tribunal";
    case "CLOS":
      return g === "AVIS" ? "Avis transmis" : g === "CONSULTATION" ? "Consultation terminée" : "Dossier terminé";
    case "APPEL_PROPOSE":
      return "Appel proposé";
    default:
      return LIBELLES_STATUT[s];
  }
}

/** Étapes affichées dans le suivi, dans l'ordre. Recours préalable (visa, naturalisation) : pas de tribunal. */
export function etapesSuivi(procedure: string): Statut[] {
  if (procedure === "CONSULTATION") return ["PAYE", "PRIS_EN_CHARGE", "CLOS"];
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
/** Statuts où le client peut encore compléter questionnaire et pièces par le jeton du dépôt (avant et après paiement). */
export const COLLECTE_OUVERTE: Statut[] = ["PRE_DOSSIER", "PAYE", "PRIS_EN_CHARGE", "EN_REDACTION", "ACTE_ATTESTE", "DEPOSE", "ENREGISTRE", "INSTRUCTION", "AUDIENCE"];

export function frDate(iso?: string | null): string {
  if (!iso) return "";
  const [a, m, j] = iso.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
}

export function frDateHeure(d?: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }).format(d);
}
