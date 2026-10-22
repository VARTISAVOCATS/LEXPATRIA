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
      "Le recours formé dans le délai empêche en principe l'éloignement jusqu'au jugement, sauf exceptions que votre avocat vérifie, et le tribunal peut annuler la décision.",
    compris: [
      "L'étude de votre dossier et la rédaction de la requête par un avocat du cabinet",
      "Le dépôt au tribunal par votre avocat",
      "Tous les mémoires en cours d'instance",
      "La plaidoirie à l'audience",
      "Le suivi jusqu'au jugement, chaque étape dans votre espace",
    ],
    nonCompris: "L'appel et les référés sont des actes distincts, proposés par votre avocat s'il les juge utiles.",
    instance: "Tribunal administratif",
  },
  REFUS_TITRE: {
    obtenir: "Le tribunal peut annuler le refus et ordonner à la préfecture de réexaminer votre demande ou de délivrer le titre.",
    compris: [
      "L'étude de votre dossier et la rédaction de la requête par un avocat du cabinet",
      "Le dépôt au tribunal par votre avocat",
      "Tous les mémoires en cours d'instance",
      "La plaidoirie à l'audience",
      "Le suivi jusqu'au jugement, chaque étape dans votre espace",
    ],
    nonCompris:
      "Si votre avocat juge un référé-suspension utile, il vous le propose (490 € s'il est engagé avec la requête) ; vous décidez alors.",
    instance: "Tribunal administratif",
  },
  REFUS_VISA: {
    obtenir:
      "Un recours préalable est obligatoire avant tout procès : l'administration réexamine le refus. En cas de nouveau rejet, le tribunal administratif de Nantes peut être saisi.",
    compris: [
      "L'étude de votre dossier et la rédaction du recours par un avocat du cabinet",
      "L'envoi en lettre recommandée avec accusé de réception, frais compris",
      "Le suivi jusqu'à la réponse de l'administration",
      "Aucun déplacement : tout se fait à distance",
    ],
    nonCompris: "En cas de rejet, la requête devant le tribunal administratif de Nantes vous est proposée à part.",
    instance: "Recours préalable, puis tribunal administratif de Nantes",
  },
  NATURALISATION: {
    obtenir:
      "Un recours préalable au ministre de l'Intérieur est obligatoire avant tout procès : il peut conduire au réexamen de votre demande.",
    compris: [
      "L'étude de votre dossier et la rédaction du recours par un avocat du cabinet",
      "L'envoi en lettre recommandée avec accusé de réception, frais compris",
      "Le suivi jusqu'à la réponse du ministre",
    ],
    nonCompris: "En cas de rejet, la requête devant le tribunal administratif de Nantes vous est proposée à part.",
    instance: "Recours préalable au ministre, puis tribunal administratif de Nantes",
  },
  REFUS_IMPLICITE: {
    obtenir:
      "Le silence de la préfecture vaut refus. Votre avocat en demande les motifs, puis le conteste devant le tribunal, qui peut ordonner le réexamen de votre demande.",
    compris: [
      "La demande des motifs du refus à la préfecture",
      "La rédaction et le dépôt de la requête par un avocat du cabinet",
      "Tous les mémoires en cours d'instance et la plaidoirie",
      "Le suivi jusqu'au jugement",
    ],
    instance: "Tribunal administratif",
  },
  BLOCAGE_EMPLOI: {
    obtenir:
      "Le juge des référés peut ordonner rapidement à la préfecture de vous donner un rendez-vous ou de vous délivrer un récépissé.",
    compris: [
      "La rédaction et le dépôt du référé par un avocat du cabinet (référé-liberté ou référé mesures utiles : votre avocat choisit la voie la plus adaptée, au même prix)",
      "L'audience devant le juge des référés",
      "Le suivi jusqu'à la décision",
    ],
    instance: "Juge des référés du tribunal administratif",
  },
  BLOCAGE_SIMPLE: {
    obtenir:
      "La mise en demeure demande formellement à la préfecture d'agir. Si elle reste sans effet, un référé peut être engagé devant le tribunal.",
    compris: [
      "La rédaction de la mise en demeure par un avocat du cabinet",
      "L'envoi en lettre recommandée avec accusé de réception, frais compris",
      "Le suivi de la réponse de la préfecture",
    ],
    nonCompris: "Si la préfecture ne répond pas, le référé vous est proposé à part (990 €).",
    instance: "Préfecture, puis juge des référés si nécessaire",
  },
  PROCEDURE_EN_COURS: {
    obtenir: "Votre avocat reprend entièrement le dossier : il étudie ce qui a été déposé, retravaille les écritures et suit la procédure jusqu'au jugement.",
    compris: [
      "L'étude complète du dossier déjà déposé",
      "Les nouvelles écritures (mémoire, réplique) rédigées et déposées par votre avocat",
      "La plaidoirie à l'audience",
      "Le suivi jusqu'au jugement",
    ],
    instance: "Tribunal administratif",
  },
  DIAGNOSTIC: {
    obtenir: "Un avocat du cabinet étudie votre situation et vous dit par écrit quelle démarche engager et dans quel délai.",
    compris: [
      "L'étude de votre situation et de vos documents par un avocat du cabinet",
      "Un avis écrit sous 48 heures ouvrées, avec la procédure conseillée",
      "69 € déduits si vous confiez ensuite le dossier au cabinet",
    ],
    instance: "Avis écrit",
  },
  CONSULTATION: {
    obtenir: "Un avocat du cabinet répond à vos questions en visio, au créneau que vous choisissez.",
    compris: ["Un entretien de 30 minutes en visio avec un avocat du cabinet", "Le lien de connexion envoyé par e-mail, avec un rappel"],
    nonCompris: "La rédaction d'un acte et le suivi d'une procédure font l'objet d'une proposition distincte.",
    instance: "Consultation en visio",
  },
};

/** Ce qui se passe après le paiement, identique pour toutes les procédures. */
export function apresPaiement(urgence: boolean): string[] {
  return [
    `Un avocat du cabinet prend votre dossier sous ${urgence ? "10" : "48"} heures ouvrées et vous écrit dans votre espace.`,
    "Vous ajoutez vos documents à votre rythme, en photo depuis votre téléphone.",
    "Votre avocat rédige et relit l'acte, puis le dépose ou l'envoie avant la date limite. Vous suivez chaque étape.",
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
