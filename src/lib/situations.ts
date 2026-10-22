// Pages informatives par situation (cahier des charges, 1 « Pages par situation »).
// Information générale, sans ton commercial ; aucun pronostic ni délai de jugement des juridictions.
// La mention « relue par un avocat du cabinet » ne s'affiche qu'une fois la date de relecture renseignée.

export type Bloc = string | string[]; // paragraphe, ou liste ; **gras** autorisé

export interface PageSituation {
  slug: string;
  nav: string;
  titre: string;
  description: string;
  chapo: string;
  sections: { titre: string; blocs: Bloc[] }[];
  textes: string;
}

export const MISE_A_JOUR = "2026-10-20";
/** Date de relecture par un avocat du cabinet ; null tant que la relecture n'est pas faite. */
export const RELUE_LE: string | null = null;

export const SITUATIONS: PageSituation[] = [
  {
    slug: "oqtf",
    nav: "OQTF",
    titre: "Contester une obligation de quitter le territoire français (OQTF)",
    description: "Délai pour contester une OQTF, effet du recours, déroulement et pièces utiles.",
    chapo:
      "L'OQTF est la décision par laquelle le préfet demande à un étranger de quitter la France. Elle peut être contestée devant le tribunal administratif, dans un délai qui dépend de votre situation au moment où elle vous est notifiée.",
    sections: [
      {
        titre: "Le délai pour agir",
        blocs: [
          "Le délai court à compter de la notification de la décision, c'est-à-dire du jour où vous l'avez reçue.",
          [
            "**Vous êtes libre :** un mois.",
            "**Vous êtes assigné à résidence ou en détention :** sept jours.",
            "**Vous êtes en centre de rétention :** quarante-huit heures.",
            "**L'OQTF fait suite au rejet de votre demande d'asile :** le délai peut être plus court ; reportez-vous à la décision.",
          ],
          "La mention des voies et délais de recours, au bas de la décision, indique le délai applicable : lisez-la en premier. Un recours gracieux auprès du préfet ne prolonge pas ce délai.",
        ],
      },
      {
        titre: "Ce que change le recours",
        blocs: [
          "Lorsque le tribunal est saisi dans le délai, l'éloignement ne peut pas être exécuté avant qu'il ait statué, sous réserve d'une assignation à résidence ou d'un placement en rétention. En Guadeloupe, en Guyane, à Mayotte, à Saint-Barthélemy et à Saint-Martin, le recours ne suspend pas l'éloignement de plein droit : une procédure de référé peut alors être nécessaire.",
        ],
      },
      {
        titre: "Ce qui est contesté",
        blocs: [
          "L'OQTF s'accompagne en général d'autres décisions : le délai de départ volontaire ou son refus, le pays de renvoi et, le cas échéant, une interdiction de retour. Elles sont contestées ensemble, dans la même requête.",
        ],
      },
      {
        titre: "Le déroulement",
        blocs: [
          "L'avocat dépose une requête au tribunal administratif compétent. La préfecture répond par un mémoire en défense, auquel l'avocat peut répliquer. L'affaire est ensuite examinée en audience. Le jugement peut faire l'objet d'un appel devant la cour administrative d'appel.",
        ],
      },
      {
        titre: "Les pièces utiles",
        blocs: [
          [
            "La décision, toutes pages, et l'enveloppe ou la preuve de notification",
            "Le passeport ou une pièce d'identité",
            "Les preuves de présence en France, année par année",
            "Les justificatifs de la situation familiale et professionnelle",
          ],
        ],
      },
    ],
    textes: "CESEDA, art. L. 611-1, L. 614-1 et suivants, L. 722-7, L. 911-1, L. 921-1 et L. 921-2 ; code de justice administrative, art. R. 811-2.",
  },
  {
    slug: "refus-titre-de-sejour",
    nav: "Refus de titre de séjour",
    titre: "Contester un refus de titre de séjour",
    description: "Délai pour contester un refus de titre de séjour ou de renouvellement, référé-suspension, ressortissants algériens.",
    chapo:
      "Le refus de délivrer ou de renouveler un titre de séjour peut être contesté devant le tribunal administratif. Le délai et la procédure dépendent de ce qui accompagne le refus.",
    sections: [
      {
        titre: "Le délai pour agir",
        blocs: [
          [
            "**Refus accompagné d'une OQTF :** le délai est celui de l'OQTF, en principe un mois lorsque vous êtes libre, et l'ensemble est contesté dans une même requête.",
            "**Refus sans OQTF :** deux mois à compter de la notification.",
          ],
          "Un recours gracieux auprès du préfet peut être formé, mais il ne prolonge pas le délai lorsqu'une OQTF accompagne le refus. La requête directe au tribunal reste la voie la plus sûre.",
        ],
      },
      {
        titre: "En cas de refus de renouvellement",
        blocs: [
          "Le refus de renouveler un titre peut faire perdre le droit au travail. Un référé-suspension peut être engagé en même temps que la requête : le juge des référés peut ordonner la délivrance d'un document provisoire.",
        ],
      },
      {
        titre: "Les ressortissants algériens",
        blocs: [
          "Les ressortissants algériens relèvent de l'accord franco-algérien du 27 décembre 1968, qui régit le certificat de résidence. Les règles du code de l'entrée et du séjour s'appliquent pour le reste, notamment la procédure.",
        ],
      },
      {
        titre: "Les pièces utiles",
        blocs: [
          [
            "La décision et la preuve de notification",
            "Le dernier titre de séjour et les récépissés",
            "Les justificatifs liés au titre demandé : famille, travail, études, santé, durée de présence",
          ],
        ],
      },
    ],
    textes: "Code de justice administrative, art. R. 421-1 et L. 521-1 ; CESEDA, art. L. 614-1 ; accord franco-algérien du 27 décembre 1968.",
  },
  {
    slug: "refus-de-visa",
    nav: "Refus de visa",
    titre: "Contester un refus de visa",
    description: "Recours préalable obligatoire contre un refus de visa (court ou long séjour), puis tribunal administratif de Nantes.",
    chapo:
      "Un refus de visa ne peut pas être porté directement devant le juge : un recours administratif préalable est obligatoire. Le tribunal administratif de Nantes est ensuite compétent pour tous les refus de visa.",
    sections: [
      {
        titre: "Le recours préalable obligatoire",
        blocs: [
          "Il doit être formé dans les trente jours suivant la notification du refus :",
          [
            "**Visa de long séjour :** auprès de la Commission de recours contre les décisions de refus de visa d'entrée en France, à Nantes ;",
            "**Visa de court séjour :** auprès du sous-directeur des visas du ministère de l'Intérieur, à Nantes.",
          ],
          "Sans réponse dans un délai de deux mois, le recours est rejeté implicitement.",
        ],
      },
      {
        titre: "Le tribunal administratif de Nantes",
        blocs: [
          "Après le rejet, explicite ou implicite, du recours préalable, le tribunal administratif de Nantes peut être saisi dans un délai de deux mois. En cas d'urgence, notamment une séparation familiale prolongée, un référé-suspension peut accompagner la requête.",
        ],
      },
      {
        titre: "Les pièces utiles",
        blocs: [
          [
            "La décision de refus et sa date de notification",
            "Le formulaire de demande et le récépissé de dépôt",
            "Les justificatifs de l'objet du séjour, des ressources et de l'hébergement",
            "Pour un conjoint de Français : acte de mariage, preuves de la vie commune",
          ],
        ],
      },
    ],
    textes: "CESEDA, livre III ; code de justice administrative, art. R. 312-18 et L. 521-1.",
  },
  {
    slug: "naturalisation",
    nav: "Naturalisation",
    titre: "Contester une décision de naturalisation",
    description: "Recours préalable au ministre contre un refus, un ajournement ou une irrecevabilité de naturalisation.",
    chapo:
      "Un refus, un ajournement ou une décision d'irrecevabilité de naturalisation peut être contesté. Un recours préalable auprès du ministre de l'Intérieur est obligatoire avant tout recours devant le juge.",
    sections: [
      {
        titre: "Le recours préalable obligatoire",
        blocs: [
          "Il est adressé au ministre de l'Intérieur, sous-direction de l'accès à la nationalité française, dans les deux mois suivant la notification de la décision. Le ministre dispose de quatre mois pour répondre ; son silence vaut rejet.",
        ],
      },
      {
        titre: "Le tribunal administratif de Nantes",
        blocs: [
          "En cas de rejet, le tribunal administratif de Nantes peut être saisi dans un délai de deux mois. Le juge contrôle notamment l'exactitude des faits retenus et l'absence d'erreur manifeste dans l'appréciation de la demande.",
        ],
      },
      {
        titre: "Refus, ajournement, irrecevabilité",
        blocs: [
          "Le refus clôt la demande. L'ajournement reporte la possibilité d'une nouvelle demande à l'expiration d'un délai fixé par la décision, ou la subordonne à des conditions. L'irrecevabilité sanctionne une condition non remplie. Le recours vise à faire réexaminer la demande au vu des éléments du dossier.",
        ],
      },
      {
        titre: "Les pièces utiles",
        blocs: [
          [
            "La décision et la preuve de notification",
            "Le dossier de demande et le récépissé",
            "Les justificatifs répondant au motif opposé : insertion professionnelle, ressources, connaissance de la langue, durée de résidence",
          ],
        ],
      },
    ],
    textes: "Code civil, art. 21-15 et suivants ; décret n° 93-1362 du 30 décembre 1993, art. 45.",
  },
  {
    slug: "prefecture-sans-reponse",
    nav: "Préfecture sans réponse",
    titre: "Quand la préfecture ne répond pas : rendez-vous, récépissé, demande en attente",
    description: "Rendez-vous impossible, récépissé expiré, demande de titre sans réponse : mise en demeure, référé, recours contre le refus implicite.",
    chapo:
      "Impossible d'obtenir un rendez-vous, récépissé expiré, demande restée sans réponse : ces situations ont des solutions devant le juge administratif, qui peut ordonner à la préfecture d'agir.",
    sections: [
      {
        titre: "La demande restée sans réponse",
        blocs: [
          "Le silence gardé par la préfecture pendant quatre mois sur une demande de titre de séjour vaut décision implicite de rejet. Ce refus peut être contesté devant le tribunal administratif dans les deux mois. Dans ce délai, il est possible de demander à la préfecture les motifs de la décision ; elle doit les communiquer dans le mois.",
        ],
      },
      {
        titre: "Le rendez-vous impossible ou le récépissé expiré",
        blocs: [
          "La première étape est en général une mise en demeure adressée à la préfecture par lettre recommandée, accompagnée des preuves des démarches. Sans réponse, le juge des référés peut être saisi d'un référé « mesures utiles » pour qu'il ordonne la délivrance d'un rendez-vous ou d'un récépissé. Lorsque la situation porte une atteinte grave et immédiate à une liberté fondamentale, par exemple quand l'emploi est menacé, un référé-liberté peut être engagé directement.",
        ],
      },
      {
        titre: "Les pièces utiles",
        blocs: [
          [
            "Les captures d'écran des tentatives de rendez-vous, datées",
            "Le dernier récépissé ou titre et la preuve du dépôt de la demande",
            "Les justificatifs des conséquences : emploi, droits sociaux, études",
          ],
        ],
      },
    ],
    textes:
      "CESEDA, art. R. 432-2 ; code des relations entre le public et l'administration, art. L. 232-4 ; code de justice administrative, art. L. 521-2 et L. 521-3.",
  },
];

export const parSlug = (s: string) => SITUATIONS.find((x) => x.slug === s);
