// Suite de la procédure, rédigée en texte suivi dans le message de confirmation du paiement.
// Le texte est composé selon le cas reconnu (référé, référé-suspension, appel) : seulement ce que le client doit savoir
// pour suivre son affaire, jamais le détail du travail de l'avocat. Aucune durée de jugement n'est annoncée
// (seuls les délais fixés par les textes à l'administration le sont).

export type ContexteSuite = {
  procedure: string;
  avisPrealable: boolean;
  cas?: string | null;
  refere?: "MESURES_UTILES" | "LIBERTE" | null;
  complements?: readonly string[];
};

const AUDIENCE = "La date de l'audience vous est communiquée. Votre présence n'est pas obligatoire.";
const JUGEMENT = "Une fois le jugement rendu, votre avocat vous l'adresse et vous en explique la portée.";
const TRIBUNAL = ["Le tribunal communique la requête à la préfecture et votre avocat répond à sa défense si nécessaire.", AUDIENCE, JUGEMENT];
const REJET_PREALABLE = "La réponse vous est transmise. En cas de rejet, le tribunal administratif de Nantes peut être saisi : c'est une procédure distincte.";
const REFERE = [
  "Le juge examine la demande en urgence. Si une audience est fixée, vous en êtes informé aussitôt.",
  "Sa décision vous est transmise avec la suite à donner auprès de l'administration.",
];

/** Phrases décrivant la suite de la procédure, à traduire une à une puis à joindre en un paragraphe. */
export function phrasesSuite(c: ContexteSuite): string[] {
  if (c.avisPrealable || c.procedure === "DIAGNOSTIC")
    return [
      "Votre avocat étudie votre situation à partir de vos réponses et de vos documents.",
      "Son avis écrit vous est remis dans votre espace sous {delai}.",
      "S'il estime qu'une procédure est utile, il vous indique laquelle et dans quel délai l'engager.",
    ];
  switch (c.procedure) {
    case "OQTF":
      return [
        "Votre avocat dépose la requête au tribunal administratif avant la date limite.",
        "Ce recours suspend en principe l'éloignement jusqu'au jugement.",
        ...TRIBUNAL,
      ];
    case "REFUS_TITRE":
      return [
        "Votre avocat dépose la requête au tribunal administratif avant la date limite.",
        ...(c.complements?.includes("REFERE_SUSPENSION_AVEC_REQUETE")
          ? ["Il demande en même temps au juge des référés de suspendre la décision jusqu'au jugement : c'est une procédure distincte, menée en parallèle."]
          : []),
        ...TRIBUNAL,
      ];
    case "REFUS_IMPLICITE":
      return [
        "Votre avocat demande d'abord à la préfecture les motifs du refus. Elle dispose d'un mois pour les communiquer.",
        "Il dépose ensuite la requête au tribunal administratif dans le délai de recours.",
        ...TRIBUNAL,
      ];
    case "REFUS_VISA":
      return [
        "Votre avocat adresse le recours préalable à l'autorité compétente en recommandé avec accusé de réception.",
        "Sans réponse dans les deux mois, le recours est réputé rejeté.",
        REJET_PREALABLE,
      ];
    case "NATURALISATION":
      return [
        "Votre avocat adresse le recours au ministre de l'Intérieur en recommandé avec accusé de réception.",
        "Sans réponse du ministre dans les quatre mois, le recours est réputé rejeté.",
        REJET_PREALABLE,
      ];
    case "BLOCAGE_EMPLOI":
      return [
        c.refere === "LIBERTE"
          ? "Votre avocat saisit le juge des référés du tribunal administratif d'un référé-liberté."
          : "Votre avocat saisit le juge des référés du tribunal administratif.",
        ...REFERE,
      ];
    case "BLOCAGE_SIMPLE":
      return [
        "Votre avocat adresse une mise en demeure à la préfecture en recommandé avec accusé de réception et vous transmet sa réponse.",
        "Si elle reste sans effet, un référé peut être engagé : c'est une procédure distincte.",
      ];
    case "PROCEDURE_EN_COURS":
      return c.cas === "JUGEMENT_DEFAVORABLE"
        ? [
            "Votre avocat étudie le jugement et vous indique, avant la date limite, si un appel devant la cour administrative d'appel est utile.",
            "L'appel est une procédure distincte de la première instance.",
          ]
        : ["Votre avocat informe le tribunal qu'il vous représente et prépare les écritures avant la prochaine échéance.", AUDIENCE, JUGEMENT];
    default:
      return [];
  }
}

/** Toutes les phrases possibles, pour la collecte des traductions et les tests. */
export function toutesPhrasesSuite(): string[] {
  const p = new Set<string>();
  for (const procedure of ["OQTF", "REFUS_TITRE", "REFUS_IMPLICITE", "REFUS_VISA", "NATURALISATION", "BLOCAGE_EMPLOI", "BLOCAGE_SIMPLE", "PROCEDURE_EN_COURS", "DIAGNOSTIC"])
    for (const cas of [null, "JUGEMENT_DEFAVORABLE"])
      for (const refere of [null, "LIBERTE"] as const)
        phrasesSuite({ procedure, avisPrealable: false, cas, refere, complements: ["REFERE_SUSPENSION_AVEC_REQUETE"] }).forEach((x) => p.add(x));
  phrasesSuite({ procedure: "REFUS_TITRE", avisPrealable: false }).forEach((x) => p.add(x));
  return [...p];
}
