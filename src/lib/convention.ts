// Convention d'honoraires en ligne (cahier des charges, section 5.2), structure VARTIS en sept articles.
// Le texte est prérempli pour chaque dossier ; le texte exact accepté est archivé avec son empreinte.
// Cinq modèles (tribunal, recours préalable, avis écrit, consultation, avenant d'appel) : chacun a un texte intégré,
// que les associés peuvent remplacer au back office (Modèles › Conventions d'honoraires). Les variables {{…}}
// sont remplies avec les données du dossier ; une variable inconnue devient XXX.
// Les versions acceptées restent consultables à l'identique dans l'espace du client.

import { MENTION_TVA_HORS_UE } from "./pays";
import { dateCourte, type Echeance, type ReglesEcheancier } from "./echeancier";
import { formatEuros, type Diligence } from "./procedures";

/** Version des modèles intégrés. Un modèle du cabinet porte sa propre version (« cabinet-N »). */
export const VERSION_CONVENTION = "2026-10-26.1";

export interface LigneHonoraires {
  diligence: Diligence;
  libelle: string;
  montant: number; // centimes TTC
}

export type CodeConvention = "CONV_TRIBUNAL" | "CONV_RECOURS_PREALABLE" | "CONV_AVIS" | "CONV_CONSULTATION" | "CONV_APPEL";

export const LIBELLES_CONVENTION: Record<CodeConvention, string> = {
  CONV_TRIBUNAL: "Convention — recours devant le tribunal",
  CONV_RECOURS_PREALABLE: "Convention — recours préalable (visa, naturalisation)",
  CONV_AVIS: "Convention — avis écrit ou diagnostic",
  CONV_CONSULTATION: "Convention — consultation en visio",
  CONV_APPEL: "Avenant d'appel",
};
export const CODES_CONVENTION = Object.keys(LIBELLES_CONVENTION) as CodeConvention[];
export const estCodeConvention = (c: string): c is CodeConvention => c in LIBELLES_CONVENTION;

/** Modèle du cabinet en vigueur pour un type de convention (absent : modèle intégré). */
export interface ModeleConvention {
  texte: string;
  version: number;
}
export type ModelesConvention = Partial<Record<CodeConvention, ModeleConvention | null>>;

export interface DonneesConvention {
  civilite?: "MADAME" | "MONSIEUR";
  prenom?: string;
  nom?: string;
  adresse?: string; // adresse postale sur une ligne
  reference: string;
  procedureLibelle: string;
  recoursPrealable: boolean; // visa, naturalisation : mission jusqu'à la réponse de l'administration
  lignes: LigneHonoraires[];
  /** Paiement en trois fois proposé : échéances calculées au jour de l'acceptation, et règles de rejet. */
  echeancier?: Echeance[] | null;
  regles?: ReglesEcheancier;
  dateLimite?: string; // JJ/MM/AAAA
  /** Client résidant hors de l'Union européenne : même prix, sans TVA (article 259 B du CGI). */
  horsUE?: boolean;
  /** Consultation en visio (entretien oral, sans acte ni procédure). */
  consultation?: boolean;
  /** Avis écrit ou diagnostic (sans acte ni procédure). */
  avis?: boolean;
  /** Avenant d'appel : référence du dossier de première instance. */
  appelDe?: string;
  /** Modèles du cabinet en vigueur (back office) ; à défaut, modèles intégrés. */
  modeles?: ModelesConvention;
}

export const MEDIATEUR =
  "Médiateur de la consommation de la profession d'avocat, 180 boulevard Haussmann, 75008 Paris, https://mediateur-consommation-avocat.fr";

const CABINET =
  "La SELARL VARTIS Avocats, société d'exercice libéral à responsabilité limitée d'avocats au barreau de Paris, " +
  "immatriculée sous le numéro 937 773 885, dont le siège est 222 boulevard Saint-Germain, 75007 Paris, " +
  "exerçant sous la dénomination commerciale LEXPATRIA Avocats, ci-après « le Cabinet »";

export function codeConvention(d: Pick<DonneesConvention, "consultation" | "avis" | "appelDe" | "recoursPrealable">): CodeConvention {
  if (d.consultation) return "CONV_CONSULTATION";
  if (d.appelDe) return "CONV_APPEL";
  if (d.avis) return "CONV_AVIS";
  if (d.recoursPrealable) return "CONV_RECOURS_PREALABLE";
  return "CONV_TRIBUNAL";
}

/** Clause du paiement en trois fois sans frais, géré par le Cabinet. */
function clauseEcheancier(d: { echeancier?: Echeance[] | null; regles?: ReglesEcheancier }): string {
  const e = d.echeancier;
  if (!e || !d.regles) return "";
  return (
    `, en une fois ou, au choix du Client, en trois fois sans frais : ${formatEuros(e[0].montant)} à la commande, puis ${formatEuros(e[1].montant)} le ${dateCourte(e[1].le)} et ${formatEuros(e[2].montant)} le ${dateCourte(e[2].le)}. ` +
    `En choisissant le paiement en trois fois, le Client autorise le Cabinet à prélever les deux dernières échéances, à leur date, sur la carte utilisée pour le premier paiement. ` +
    `Une échéance rejetée peut être présentée à nouveau. Si elle n'est pas régularisée dans un délai de ${d.regles.regularisationJours} jours, une pénalité forfaitaire de ${formatEuros(d.regles.penalite)} est due, ainsi que des intérêts au taux légal sur la somme restant due`
  );
}

// ---------- Variables des modèles ----------

export interface VariableConvention {
  nom: string;
  libelle: string;
  valeur: (d: DonneesConvention, version: string) => string;
}

const identiteClient = (d: DonneesConvention) =>
  d.prenom || d.nom
    ? `${d.civilite === "MADAME" ? "Madame" : d.civilite === "MONSIEUR" ? "Monsieur" : ""} ${d.prenom ?? ""} ${d.nom ?? ""}`.replace(/\s+/g, " ").trim()
    : "Le client identifié lors du dépôt";

export const VARIABLES_CONVENTION: VariableConvention[] = [
  { nom: "reference", libelle: "Référence du dossier", valeur: (d) => d.reference },
  { nom: "version", libelle: "Version de la convention", valeur: (_, v) => v },
  { nom: "cabinet", libelle: "Désignation complète de la SELARL VARTIS Avocats", valeur: () => CABINET },
  { nom: "client", libelle: "Civilité, prénom et nom du client", valeur: identiteClient },
  { nom: "demeurant", libelle: "« , demeurant [adresse] » (vide si l'adresse manque)", valeur: (d) => (d.adresse ? `, demeurant ${d.adresse}` : "") },
  { nom: "mission", libelle: "Intitulé de la procédure ou de la prestation", valeur: (d) => d.procedureLibelle },
  { nom: "dossier_initial", libelle: "Référence du dossier de première instance (avenant d'appel)", valeur: (d) => d.appelDe ?? "" },
  { nom: "honoraires", libelle: "Liste des honoraires, une ligne par diligence", valeur: (d) => d.lignes.map((l) => `- ${l.libelle} : ${formatEuros(l.montant)}${d.horsUE ? "" : " TTC"}`).join("\n") },
  {
    nom: "total",
    libelle: "Total, avec « TTC » ou la mention d'exonération hors UE",
    valeur: (d) => `${formatEuros(d.lignes.reduce((s, l) => s + l.montant, 0))}${d.horsUE ? ` (${MENTION_TVA_HORS_UE})` : " TTC"}`,
  },
  { nom: "paiement_trois_fois", libelle: "Clause du paiement en trois fois (vide s'il n'est pas proposé), placée juste avant le point", valeur: (d) => clauseEcheancier(d) },
  {
    nom: "date_limite",
    libelle: "Paragraphe de la date limite estimée (vide si elle n'est pas connue)",
    valeur: (d) => (d.dateLimite ? `\n\nDate limite ${d.appelDe ? "d'appel" : "de recours"} estimée au jour de la convention, sous réserve de vérification par l'avocat : ${d.dateLimite}.` : ""),
  },
  { nom: "mediateur", libelle: "Coordonnées du médiateur de la consommation", valeur: () => MEDIATEUR },
];

/** Variables inconnues d'un modèle de convention (signalées à l'enregistrement). */
export function variablesConventionInconnues(texte: string): string[] {
  const connues = new Set(VARIABLES_CONVENTION.map((x) => x.nom));
  return [...new Set([...texte.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((m) => m[1]).filter((n) => !connues.has(n)))];
}

function remplir(texte: string, d: DonneesConvention, version: string): string {
  const parNom = new Map(VARIABLES_CONVENTION.map((x) => [x.nom, x]));
  return texte.replace(/\{\{\s*([A-Za-z_]+)\s*\}\}/g, (_, nom: string) => {
    const x = parNom.get(nom);
    return x ? x.valeur(d, version) : "XXX";
  });
}

// ---------- Modèles intégrés ----------

const EXCLUSIONS_PREMIERE_INSTANCE =
  "Sont exclus de la mission : l'appel, les procédures de référé non prévues ci-dessous, l'exécution de la décision et toute procédure devant le juge judiciaire. L'appel et les référés font, le cas échéant, l'objet d'un avenant soumis à l'accord du Client.";
const EXAMEN = "Avant le dépôt, l'avocat attribué examine le dossier, vérifie la date de notification de la décision et le délai de recours.";
const REMBOURSEMENT =
  "Si l'avocat constate, à l'examen du dossier, que le délai de recours était déjà expiré au jour du paiement, aucune procédure n'est engagée : les honoraires sont remboursés, sous déduction de 69 € correspondant à l'examen du dossier et à l'avis écrit remis au Client. Une fois la procédure engagée, elle est menée jusqu'au dépôt ; aucun remboursement n'intervient après le dépôt.";

const MISSIONS: Record<CodeConvention, { mission: string; exclusions: string; obligation: string; article2: string }> = {
  CONV_TRIBUNAL: {
    mission: "La mission couvre l'ensemble de la première instance : rédaction et dépôt de la requête, tous les mémoires utiles et la plaidoirie à l'audience lorsque l'avocat l'estime opportune.",
    exclusions: EXCLUSIONS_PREMIERE_INSTANCE,
    obligation: EXAMEN,
    article2: REMBOURSEMENT,
  },
  CONV_RECOURS_PREALABLE: {
    mission: "La mission s'achève à la réponse de l'administration ou à la naissance d'une décision implicite de rejet. En cas de rejet, la requête devant le tribunal administratif fait l'objet d'une proposition distincte.",
    exclusions: EXCLUSIONS_PREMIERE_INSTANCE,
    obligation: EXAMEN,
    article2: REMBOURSEMENT,
  },
  CONV_AVIS: {
    mission: "La mission consiste en l'étude de la situation du Client et de ses documents, et en la remise d'un avis écrit dans son espace. Elle ne comprend ni la rédaction d'un acte ni le suivi d'une procédure, qui font, le cas échéant, l'objet d'une proposition distincte.",
    exclusions: "Sont exclus de la mission la rédaction de tout acte et toute procédure, administrative ou juridictionnelle, qui font, le cas échéant, l'objet d'une proposition distincte soumise à l'accord du Client.",
    obligation: "L'avis écrit est remis dans l'espace du Client.",
    article2: "Une fois l'avis écrit remis, les honoraires restent acquis au Cabinet.",
  },
  CONV_CONSULTATION: {
    mission: "La mission consiste en un entretien de trente minutes en visioconférence avec un avocat du Cabinet, au créneau choisi par le Client. Elle ne comprend ni la rédaction d'un acte ni le suivi d'une procédure, qui font, le cas échéant, l'objet d'une proposition distincte.",
    exclusions: EXCLUSIONS_PREMIERE_INSTANCE,
    obligation: "Le Client peut déplacer le rendez-vous au plus tard vingt-quatre heures à l'avance, par le lien reçu par e-mail.",
    article2: "Si le Client ne se présente pas au rendez-vous sans l'avoir déplacé, la consultation est due.",
  },
  CONV_APPEL: {
    mission:
      "La mission couvre l'instance d'appel : rédaction et dépôt de la requête d'appel, tous les mémoires utiles et la plaidoirie devant la cour lorsque l'avocat l'estime opportune. Elle complète la convention acceptée pour le dossier de première instance {{dossier_initial}}, dont les autres stipulations demeurent.",
    exclusions:
      "Sont exclus de la mission : le pourvoi en cassation, les procédures de référé non prévues ci-dessous, l'exécution de la décision et toute procédure devant le juge judiciaire. Les référés font, le cas échéant, l'objet d'un avenant soumis à l'accord du Client.",
    obligation: "Avant le dépôt, l'avocat attribué examine le dossier, vérifie la date de notification de la décision et le délai de recours (ici, la date de notification du jugement et le délai d'appel).",
    article2: REMBOURSEMENT,
  },
};

/** Texte du modèle intégré, avec ses variables {{…}} (affiché au back office comme point de départ). */
export function modeleIntegre(code: CodeConvention): string {
  const m = MISSIONS[code];
  return `${code === "CONV_APPEL" ? "AVENANT D'APPEL À LA CONVENTION D'HONORAIRES" : "CONVENTION D'HONORAIRES"} — DOSSIER {{reference}}
Version {{version}}

ENTRE
{{cabinet}},
D'UNE PART,

ET
{{client}}{{demeurant}}, ci-après « le Client »,
D'AUTRE PART.

EXPOSÉ PRÉALABLE
Le Client a été informé que le Cabinet n'intervient pas au titre de l'aide juridictionnelle et qu'il lui appartient de vérifier si un contrat d'assurance de protection juridique peut prendre en charge tout ou partie des honoraires.

ARTICLE 1 — OBJET ET PÉRIMÈTRE
Le Client confie au Cabinet la mission suivante : {{mission}}.
${m.mission}
${m.exclusions}
Le Cabinet est tenu d'une obligation de moyens. Le Client s'engage à fournir des informations exactes et les pièces demandées dans les meilleurs délais. ${m.obligation}

ARTICLE 2 — HONORAIRES
Les honoraires sont fixés forfaitairement comme suit :
{{honoraires}}
Total : {{total}}.
Ce forfait est ferme. Il ne comporte aucun honoraire de résultat. Hors Île-de-France, seuls les frais de déplacement de l'avocat pour l'audience font l'objet d'un avenant soumis à l'accord préalable du Client.
${m.article2}
Les sommes que la juridiction pourrait mettre à la charge de l'administration au titre de l'article L. 761-1 du code de justice administrative reviennent au Client. Le Cabinet n'en assure pas le recouvrement mais indique au Client la marche à suivre pour les obtenir.

ARTICLE 3 — FRAIS ET MODALITÉS DE RÈGLEMENT
Les frais d'envoi des courriers recommandés sont compris dans le forfait. Les honoraires sont réglés en ligne, par carte bancaire{{paiement_trois_fois}}. Une note d'honoraires est émise à chaque paiement.

ARTICLE 4 — DURÉE, RÉTRACTATION ET DESSAISISSEMENT
La convention prend effet à son acceptation. Le Client dispose d'un délai de rétractation de quatorze jours. En demandant l'exécution immédiate de la mission, il reconnaît que, si le délai de recours l'exige, le Cabinet commencera son intervention avant l'expiration de ce délai, et qu'en cas de rétractation les diligences déjà accomplies resteront dues.
Le Client peut à tout moment dessaisir le Cabinet. Le Cabinet peut se décharger du dossier dans le respect des règles de la profession, en veillant à ce que les intérêts du Client ne soient pas compromis.
La présente convention ne comporte aucune clause de transfert de l'activité ou du dossier à une autre structure.

ARTICLE 5 — OBLIGATIONS DÉONTOLOGIQUES
Le Cabinet est tenu au secret professionnel. Il a vérifié l'absence de conflit d'intérêts et respecte ses obligations en matière de lutte contre le blanchiment des capitaux. Sa responsabilité civile professionnelle est assurée dans le cadre du contrat collectif du barreau de Paris.
Le Client est informé que des outils d'intelligence artificielle assistent l'avocat dans la lecture des décisions et des pièces, l'analyse du dossier et la préparation des projets d'actes. L'avocat relit et valide personnellement tout acte et tout avis ; aucune décision n'est prise de manière automatisée. Les données transmises au modèle d'intelligence artificielle sont limitées au strict nécessaire, font l'objet d'un transfert hors de l'Union européenne encadré par contrat et ne sont pas réutilisées pour l'entraînement des modèles.
Les données personnelles du Client sont traitées conformément à la politique de confidentialité accessible sur le site.

ARTICLE 6 — CONTESTATIONS ET MÉDIATION
Toute contestation relative aux honoraires est portée devant le Bâtonnier de l'Ordre des avocats de Paris, conformément aux articles 174 et suivants du décret n° 91-1197 du 27 novembre 1991.
Le Client reconnaît avoir reçu l'information relative à l'existence d'un médiateur de la consommation. Conformément aux articles L.612-1 et L.616-1 du Code de la consommation, il peut, en cas de différend avec le Cabinet et après une réclamation écrite adressée au Cabinet, recourir au {{mediateur}}.

ARTICLE 7 — STIPULATIONS DIVERSES
La convention est conclue à distance, par voie électronique. La case d'acceptation cochée par le Client vaut signature ; la date, l'heure, la version et l'empreinte du texte accepté sont conservées et le Client peut relire à tout moment le texte exact accepté dans son espace. La convention est soumise au droit français.{{date_limite}}
`;
}

/** Version de la convention applicable à ces données (modèle intégré ou modèle du cabinet). */
export function versionConvention(d: DonneesConvention): string {
  const m = d.modeles?.[codeConvention(d)];
  return m?.texte.trim() ? `cabinet-${m.version}` : VERSION_CONVENTION;
}

export function texteConvention(d: DonneesConvention): string {
  const code = codeConvention(d);
  const m = d.modeles?.[code];
  const gabarit = m?.texte.trim() ? m.texte : modeleIntegre(code);
  return remplir(gabarit, d, versionConvention(d));
}

/** Données fictives pour l'aperçu d'un modèle de convention au back office. */
export function donneesExempleConvention(code: CodeConvention): DonneesConvention {
  return {
    civilite: "MADAME",
    prenom: "Nadia",
    nom: "Exemple",
    adresse: "12 rue de la Paix, 94000 Créteil",
    reference: "D0000",
    procedureLibelle:
      code === "CONV_CONSULTATION"
        ? "Consultation en visio avec un avocat"
        : code === "CONV_AVIS"
          ? "Avis écrit d'un avocat sur votre situation"
          : code === "CONV_RECOURS_PREALABLE"
            ? "Recours préalable contre un refus de visa"
            : code === "CONV_APPEL"
              ? "Appel devant la cour administrative d'appel du jugement rendu dans le dossier D0001 (Recours contre une OQTF)"
              : "Recours contre une OQTF",
    recoursPrealable: code === "CONV_RECOURS_PREALABLE",
    consultation: code === "CONV_CONSULTATION",
    avis: code === "CONV_AVIS",
    appelDe: code === "CONV_APPEL" ? "D0001" : undefined,
    lignes: [{ diligence: "REQUETE", libelle: "Requête devant le tribunal administratif", montant: 99_000 }],
    dateLimite: code === "CONV_CONSULTATION" || code === "CONV_AVIS" ? undefined : "20/11/2026",
  };
}

/** Résumé en trois lignes affiché au-dessus de la case d'acceptation (cahier des charges, 4.10). */
export function resumeConvention(d: DonneesConvention): string[] {
  const total = d.lignes.reduce((s, l) => s + l.montant, 0);
  if (d.consultation)
    return [
      `${formatEuros(total)}${d.horsUE ? "" : " TTC"} pour un entretien de 30 minutes en visio avec un avocat du cabinet.`,
      "Vous choisissez votre créneau juste après le paiement ; le lien de connexion vous est envoyé par e-mail.",
      "Rendez-vous déplaçable jusqu'à 24 heures à l'avance.",
    ];
  if (d.avis)
    return [
      `Forfait ferme de ${formatEuros(total)}${d.horsUE ? "" : " TTC"} pour l'avis écrit d'un avocat du cabinet.`,
      "L'avis écrit vous est remis dans votre espace sous 48 heures ouvrées.",
      "Il vous indique la démarche à engager et son délai.",
    ];
  return [
    `Forfait ferme de ${formatEuros(total)}${d.horsUE ? "" : " TTC"} pour ${d.appelDe ? "toute l'instance d'appel" : d.recoursPrealable ? "le recours préalable, jusqu'à la réponse de l'administration" : "toute la première instance"}.`,
    "Un avocat du cabinet étudie votre dossier et forme votre recours.",
    "Délai déjà expiré au jour du paiement : remboursement, 69 € conservés pour l'avis écrit.",
  ];
}
