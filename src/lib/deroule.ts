// Déroulé de la procédure, étape par étape, envoyé au client après le message de confirmation du paiement.
// Seulement ce que le client doit savoir pour suivre son affaire : jamais le détail du travail de l'avocat.
// Aucune durée de jugement n'est annoncée (seuls les délais fixés par les textes à l'administration le sont).

import type { CodeProcedure } from "./procedures";

const PRISE_EN_CHARGE = "Nous prenons votre dossier en charge sous {delai}. L'avocat chargé de votre dossier se présente dans votre espace.";
const SUIVI = "Vous suivez chaque étape dans votre espace et pouvez nous y écrire à tout moment.";

const TRIBUNAL = [
  "Le tribunal enregistre la requête et la communique à la préfecture, qui présente sa défense. Nous y répondons si nécessaire.",
  "Le tribunal fixe une audience. Nous vous en communiquons la date. Votre présence n'est pas obligatoire.",
  "Le jugement est rendu. Nous vous l'adressons et vous expliquons ce qu'il change pour vous.",
];

export const DEROULE: Partial<Record<CodeProcedure, string[]>> = {
  OQTF: [
    PRISE_EN_CHARGE,
    "Vous nous transmettez vos documents depuis votre espace : la décision, l'enveloppe ou la preuve de notification, puis vos autres pièces.",
    "Nous déposons votre requête au tribunal administratif avant la date limite. Formé dans le délai, ce recours empêche en principe votre éloignement jusqu'au jugement.",
    ...TRIBUNAL,
  ],
  REFUS_TITRE: [
    PRISE_EN_CHARGE,
    "Vous nous transmettez vos documents depuis votre espace : la décision, l'enveloppe ou la preuve de notification, puis vos autres pièces.",
    "Nous déposons votre requête au tribunal administratif avant la date limite.",
    ...TRIBUNAL,
  ],
  REFUS_IMPLICITE: [
    PRISE_EN_CHARGE,
    "Vous nous transmettez la preuve du dépôt de votre demande et vos autres documents depuis votre espace.",
    "Nous demandons à la préfecture les motifs de son refus. Elle dispose d'un mois pour les communiquer.",
    "Nous déposons ensuite la requête au tribunal administratif, dans le délai de recours.",
    ...TRIBUNAL,
  ],
  REFUS_VISA: [
    PRISE_EN_CHARGE,
    "Vous nous transmettez la décision de refus et les pièces de votre demande de visa depuis votre espace.",
    "Nous adressons votre recours préalable en recommandé avec accusé de réception à l'autorité compétente.",
    "L'administration dispose de deux mois pour répondre. Sans réponse dans ce délai, le recours est réputé rejeté.",
    "Nous vous transmettons la réponse. En cas de rejet, un recours devant le tribunal administratif de Nantes reste possible. Il fait l'objet d'une offre distincte.",
  ],
  NATURALISATION: [
    PRISE_EN_CHARGE,
    "Vous nous transmettez la décision et les pièces de votre demande de naturalisation depuis votre espace.",
    "Nous adressons votre recours au ministre de l'Intérieur en recommandé avec accusé de réception.",
    "Le ministre dispose de quatre mois pour répondre. Sans réponse dans ce délai, le recours est réputé rejeté.",
    "Nous vous transmettons la réponse. En cas de rejet, un recours devant le tribunal administratif de Nantes reste possible. Il fait l'objet d'une offre distincte.",
  ],
  BLOCAGE_EMPLOI: [
    PRISE_EN_CHARGE,
    "Vous nous transmettez depuis votre espace votre récépissé ou la preuve de vos démarches, et un document de votre employeur.",
    "Nous déposons le référé au tribunal administratif.",
    "Le juge des référés examine la demande en urgence. Si une audience est fixée, nous vous prévenons aussitôt.",
    "Nous vous transmettons sa décision et vous indiquons la suite à donner auprès de la préfecture.",
  ],
  BLOCAGE_SIMPLE: [
    PRISE_EN_CHARGE,
    "Vous nous transmettez depuis votre espace votre récépissé ou la preuve de vos démarches auprès de la préfecture.",
    "Nous adressons la mise en demeure à la préfecture en recommandé avec accusé de réception.",
    "Nous suivons la réponse de la préfecture et vous la transmettons.",
    "Si la mise en demeure reste sans effet, un référé peut être engagé. Nous vous le proposons. Il fait l'objet d'une offre distincte.",
  ],
  PROCEDURE_EN_COURS: [
    PRISE_EN_CHARGE,
    "Vous nous transmettez depuis votre espace tout ce qui a déjà été déposé : la requête, les pièces et les courriers du tribunal.",
    "Nous informons le tribunal que nous vous représentons et préparons les écritures avant la prochaine échéance.",
    ...TRIBUNAL.slice(1),
  ],
  DIAGNOSTIC: [
    "Nous étudions votre situation à partir de vos réponses et de vos documents.",
    "Vous recevez notre avis écrit dans votre espace sous {delai}.",
    "Si une procédure est utile, l'avis vous indique laquelle et dans quel délai l'engager.",
  ],
};

/** Étapes à envoyer au client pour ce dossier (avis préalable traité comme un diagnostic). */
export function etapesDeroule(procedure: string, avisPrealable: boolean): string[] {
  const liste = avisPrealable ? DEROULE.DIAGNOSTIC : DEROULE[procedure as CodeProcedure];
  return liste ? [...liste, SUIVI] : [];
}
