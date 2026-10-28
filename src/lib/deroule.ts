// Déroulé de la procédure, étape par étape, envoyé au client après le message de confirmation du paiement.
// Seulement ce que le client doit savoir pour suivre son affaire : jamais le détail du travail de l'avocat.
// Aucune durée de jugement n'est annoncée (seuls les délais fixés par les textes à l'administration le sont).

import type { CodeProcedure } from "./procedures";

const PRISE_EN_CHARGE = "Un avocat du cabinet prend votre dossier en charge sous {delai} et se présente à vous dans votre espace.";
const SUIVI = "Vous suivez chaque étape dans votre espace et pouvez y écrire à votre avocat à tout moment.";

const TRIBUNAL = [
  "Le tribunal communique la requête à la préfecture. Votre avocat répond à sa défense si nécessaire.",
  "La date de l'audience vous est communiquée. Votre présence n'est pas obligatoire.",
  "Une fois le jugement rendu, votre avocat vous l'adresse et vous en explique la portée.",
];

export const DEROULE: Partial<Record<CodeProcedure, string[]>> = {
  OQTF: [
    PRISE_EN_CHARGE,
    "Vous transmettez depuis votre espace l'enveloppe ou la preuve de notification puis vos autres pièces.",
    "Votre avocat dépose la requête au tribunal administratif avant la date limite. Ce recours suspend en principe l'éloignement jusqu'au jugement.",
    ...TRIBUNAL,
  ],
  REFUS_TITRE: [
    PRISE_EN_CHARGE,
    "Vous transmettez depuis votre espace l'enveloppe ou la preuve de notification puis vos autres pièces.",
    "Votre avocat dépose la requête au tribunal administratif avant la date limite.",
    ...TRIBUNAL,
  ],
  REFUS_IMPLICITE: [
    PRISE_EN_CHARGE,
    "Vous transmettez depuis votre espace la preuve du dépôt de votre demande et vos autres documents.",
    "Votre avocat demande à la préfecture les motifs du refus. Elle dispose d'un mois pour les communiquer.",
    "Il dépose ensuite la requête au tribunal administratif, dans le délai de recours.",
    ...TRIBUNAL,
  ],
  REFUS_VISA: [
    PRISE_EN_CHARGE,
    "Vous transmettez depuis votre espace la décision de refus et les pièces de votre demande de visa.",
    "Votre avocat adresse le recours préalable à l'autorité compétente, en recommandé avec accusé de réception.",
    "Sans réponse de l'administration dans les deux mois, le recours est réputé rejeté.",
    "La réponse vous est transmise. En cas de rejet, le tribunal administratif de Nantes peut être saisi dans le cadre d'une offre distincte.",
  ],
  NATURALISATION: [
    PRISE_EN_CHARGE,
    "Vous transmettez depuis votre espace la décision et les pièces de votre demande de naturalisation.",
    "Votre avocat adresse le recours au ministre de l'Intérieur, en recommandé avec accusé de réception.",
    "Sans réponse du ministre dans les quatre mois, le recours est réputé rejeté.",
    "La réponse vous est transmise. En cas de rejet, le tribunal administratif de Nantes peut être saisi dans le cadre d'une offre distincte.",
  ],
  BLOCAGE_EMPLOI: [
    PRISE_EN_CHARGE,
    "Vous transmettez depuis votre espace votre récépissé ou la preuve de vos démarches, ainsi qu'un document de votre employeur.",
    "Votre avocat dépose le référé au tribunal administratif.",
    "Le juge des référés examine la demande en urgence. Vous êtes informé sans délai de toute audience.",
    "Sa décision vous est transmise, avec la suite à donner auprès de la préfecture.",
  ],
  BLOCAGE_SIMPLE: [
    PRISE_EN_CHARGE,
    "Vous transmettez depuis votre espace votre récépissé ou la preuve de vos démarches auprès de la préfecture.",
    "Votre avocat adresse la mise en demeure à la préfecture, en recommandé avec accusé de réception.",
    "Il suit la réponse de la préfecture et vous la transmet.",
    "Si la mise en demeure reste sans effet, un référé peut vous être proposé dans le cadre d'une offre distincte.",
  ],
  PROCEDURE_EN_COURS: [
    PRISE_EN_CHARGE,
    "Vous transmettez depuis votre espace tout ce qui a déjà été déposé : la requête, les pièces et les courriers du tribunal.",
    "Votre avocat informe le tribunal qu'il vous représente et prépare les écritures avant la prochaine échéance.",
    ...TRIBUNAL.slice(1),
  ],
  DIAGNOSTIC: [
    "Un avocat du cabinet étudie votre situation à partir de vos réponses et de vos documents.",
    "Son avis écrit vous est remis dans votre espace sous {delai}.",
    "Si une procédure est utile, l'avis indique laquelle et dans quel délai l'engager.",
  ],
};

/** Étapes à envoyer au client pour ce dossier (avis préalable traité comme un diagnostic). */
export function etapesDeroule(procedure: string, avisPrealable: boolean): string[] {
  const liste = avisPrealable ? DEROULE.DIAGNOSTIC : DEROULE[procedure as CodeProcedure];
  return liste ? [...liste, SUIVI] : [];
}
