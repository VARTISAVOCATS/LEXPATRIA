// Textes du parcours propres à chaque procédure (écrans « Résultat » et « Votre recours »).
// Information générale : ni argument juridique, ni pronostic. Modifiables au back office (lot 5).

import type { CodeProcedure } from "./procedures";

export interface ContenuProcedure {
  /** Ce que la démarche peut obtenir, quand l'IA n'a rien produit. */
  obtenir: string;
  /** Ce qui est compris dans le prix. */
  compris: string[];
  /** Ce qui n'est pas compris, annoncé franchement. */
  nonCompris?: string;
  /** Où l'affaire est portée, en une ligne. */
  instance: string;
}

export const CONTENUS: Record<CodeProcedure, ContenuProcedure> = {
  OQTF: {
    obtenir:
      "Le recours formé dans le délai suspend en principe l'éloignement jusqu'au jugement. Le tribunal peut annuler la décision.",
    compris: [
      "La rédaction de la requête par un avocat du cabinet",
      "Son dépôt au tribunal",
      "Le suivi jusqu'au jugement",
    ],
    nonCompris: "L'appel et les référés sont des actes distincts.",
    instance: "Tribunal administratif",
  },
  REFUS_TITRE: {
    obtenir: "Le tribunal peut annuler le refus et ordonner le réexamen de la demande ou la délivrance du titre.",
    compris: [
      "La rédaction de la requête par un avocat du cabinet",
      "Son dépôt au tribunal",
      "Le suivi jusqu'au jugement",
    ],
    nonCompris:
      "Un référé-suspension peut vous être proposé s'il est utile (490 €).",
    instance: "Tribunal administratif",
  },
  REFUS_VISA: {
    obtenir:
      "Un recours préalable est obligatoire : l'administration réexamine le refus. En cas de rejet, le tribunal administratif de Nantes peut être saisi.",
    compris: [
      "La rédaction du recours par un avocat du cabinet",
      "Son envoi en recommandé avec accusé de réception",
      "Le suivi jusqu'à la réponse de l'administration",
      "Aucun déplacement : tout se fait à distance",
    ],
    nonCompris: "En cas de rejet, le recours devant le tribunal fait l'objet d'une offre distincte.",
    instance: "Recours préalable, puis tribunal administratif de Nantes",
  },
  NATURALISATION: {
    obtenir:
      "Un recours préalable auprès du ministre de l'Intérieur est obligatoire. Il peut conduire au réexamen de la demande.",
    compris: [
      "La rédaction du recours par un avocat du cabinet",
      "Son envoi en recommandé avec accusé de réception",
      "Le suivi jusqu'à la réponse du ministre",
    ],
    nonCompris: "En cas de rejet, le recours devant le tribunal fait l'objet d'une offre distincte.",
    instance: "Recours préalable au ministre, puis tribunal administratif de Nantes",
  },
  REFUS_IMPLICITE: {
    obtenir:
      "Le silence de la préfecture vaut refus. Ses motifs sont demandés, puis le refus est contesté devant le tribunal.",
    compris: [
      "La demande des motifs à la préfecture",
      "La rédaction et le dépôt de la requête",
      "Le suivi jusqu'au jugement",
    ],
    instance: "Tribunal administratif",
  },
  BLOCAGE_EMPLOI: {
    obtenir:
      "Le juge des référés peut ordonner rapidement à la préfecture de vous donner un rendez-vous ou de vous délivrer un récépissé.",
    compris: [
      "Le référé adapté à votre situation (référé-liberté ou référé mesures utiles)",
      "Son dépôt au tribunal",
      "Le suivi jusqu'à la décision",
    ],
    instance: "Juge des référés du tribunal administratif",
  },
  BLOCAGE_SIMPLE: {
    obtenir:
      "La mise en demeure demande formellement à la préfecture d'agir. Si elle reste sans effet, un référé peut être engagé devant le tribunal.",
    compris: [
      "La rédaction de la mise en demeure",
      "Son envoi en recommandé avec accusé de réception",
      "Le suivi de la réponse de la préfecture",
    ],
    nonCompris: "Sans réponse de la préfecture, un référé peut être engagé (990 €).",
    instance: "Préfecture, puis juge des référés si nécessaire",
  },
  PROCEDURE_EN_COURS: {
    obtenir: "Le cabinet reprend entièrement le dossier, retravaille les écritures et suit la procédure jusqu'au jugement.",
    compris: [
      "L'étude du dossier déjà déposé",
      "Les nouvelles écritures",
      "Le suivi jusqu'au jugement",
    ],
    instance: "Tribunal administratif",
  },
  DIAGNOSTIC: {
    obtenir: "Un avocat du cabinet étudie votre situation et vous indique par écrit la démarche à engager et son délai.",
    compris: [
      "L'étude de votre situation et de vos documents",
      "Un avis écrit sous 48 heures ouvrées",
      "69 € déduits si vous confiez ensuite le dossier au cabinet",
    ],
    instance: "Avis écrit",
  },
  CONSULTATION: {
    obtenir: "Un avocat du cabinet répond à vos questions en visio, au créneau que vous choisissez.",
    compris: ["Un entretien de 30 minutes en visio avec un avocat du cabinet", "Le lien de connexion et un rappel par e-mail"],
    nonCompris: "La rédaction d'un acte fait l'objet d'une offre distincte.",
    instance: "Consultation en visio",
  },
};

/** Ce qui se passe après le paiement, identique pour toutes les procédures. */
export function apresPaiement(urgence: boolean): string[] {
  return [
    `Un avocat du cabinet prend votre dossier sous ${urgence ? "10" : "48"} heures ouvrées.`,
    "Vous transmettez vos documents en photo, depuis votre téléphone.",
    "Votre recours est déposé avant la date limite. Vous suivez chaque étape dans votre espace.",
  ];
}

/** Situations courantes proposées dans la barre de récit (autocomplétion). */
export const SUGGESTIONS = [
  "J'ai reçu une OQTF",
  "Mon titre de séjour est refusé",
  "Mon renouvellement de titre est refusé",
  "Mon visa est refusé",
  "Ma naturalisation est refusée ou ajournée",
  "Impossible d'avoir un rendez-vous en préfecture",
  "Mon récépissé a expiré",
  "La préfecture ne répond pas à ma demande",
  "J'ai déjà un recours en cours au tribunal",
  "Je ne sais pas quoi faire",
];
