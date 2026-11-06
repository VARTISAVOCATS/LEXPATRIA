// Questionnaire et liste de pièces adaptés à la situation (cahier des charges, 4.7, 4.9, 6.0 et 6.2).
// Utilisé avant le paiement pour l'avis préalable et le diagnostic, après le paiement pour les procédures.
// Une question par écran ; deux au plus, seulement si elles sont de même nature (champ `avec`).

import { CERTIFICATS, CONSULATS, NOMBRES_ENFANTS, PREFECTURES, TITRES, VISAS_ENTREE } from "./listes";
import type { CodeProcedure } from "./procedures";

export type Reponses = Record<string, string | undefined>;

export interface Question {
  id: string;
  libelle: string;
  type: "date" | "texte" | "texte_long" | "oui_non" | "choix" | "liste" | "nombre";
  options?: [string, string][];
  /** Libellés de liste non traduits (noms propres : préfectures, consulats). */
  brut?: boolean;
  aide?: string;
  /** Question de même nature affichée sur le même écran. */
  avec?: Question;
  facultative?: boolean;
}

export interface Contexte {
  procedure: CodeProcedure;
  algerien: boolean | null;
  avisOuDiagnostic: boolean;
  /** Cas reconnu à l'orientation (code du référentiel ou LIBRE) : adapte les questions et les pièces. */
  cas?: string;
  /** Pièces propres au cas reconnu (référentiel), à la place des pièces génériques de la procédure. */
  pieces?: string[];
  /** Décision implicite de rejet : aucune décision écrite à transmettre. */
  implicite?: boolean;
  /** Préfecture déjà indiquée avant le paiement : la question n'est pas reposée. */
  prefectureConnue?: boolean;
}

/** Cas pour lesquels la question correspondante est déjà tranchée par l'orientation. */
const CAS_TITRE_DETERMINE = ["REFUS_PREMIERE_DEMANDE", "REFUS_RENOUVELLEMENT", "RETRAIT_TITRE", "REFUS_CHANGEMENT_STATUT", "REFUS_CARTE_RESIDENT"];
const CAS_FONDEMENT_CONNU = ["REFUS_CARTE_RESIDENT"];
const CAS_HORS_TITRE = ["REFUS_REGROUPEMENT_FAMILIAL", "REFUS_AUTORISATION_TRAVAIL"];
const MOTIF_VISA: Record<string, string> = { VISA_CONJOINT_FRANCAIS: "conjoint", VISA_FAMILLE: "famille", VISA_ETUDIANT: "etudes" };
const CAS_SANS_CERTIFICAT = ["NATURALISATION_SANS_SUITE", "DOCUMENTS_RETENUS", "RETOUR_IMPOSSIBLE", "REFUS_REGROUPEMENT_FAMILIAL", "REFUS_AUTORISATION_TRAVAIL"];

const FAMILLE: [string, string][] = [
  ["celibataire", "Célibataire"],
  ["marie", "Marié(e)"],
  ["pacs", "Pacsé(e)"],
  ["concubinage", "En concubinage"],
  ["separe", "Divorcé(e) ou séparé(e)"],
];

export function questions(c: Contexte, r: Reponses): Question[] {
  const p = c.procedure;
  const Q: Question[] = [];
  const sejour = p !== "REFUS_VISA" && p !== "PROCEDURE_EN_COURS";
  const blocage = p === "BLOCAGE_EMPLOI" || p === "BLOCAGE_SIMPLE";
  const cas = c.cas ?? "";
  const citoyenUE = cas === "OQTF_CITOYEN_UE";

  if (p === "DIAGNOSTIC") {
    Q.push({ id: "decisionRecue", libelle: "Avez-vous reçu une décision écrite de l'administration ?", type: "oui_non" });
  }

  if (sejour) {
    Q.push({
      id: "entree",
      libelle: "Quand êtes-vous entré(e) en France ?",
      type: "date",
      aide: "Une date approximative suffit.",
      avec: {
        id: "modeEntree",
        libelle: "Avec quel visa ?",
        type: "liste",
        options: VISAS_ENTREE,
      },
    });
    if (!citoyenUE) Q.push({ id: "titreAnt", libelle: "Avez-vous déjà eu un titre de séjour en France ?", type: "oui_non" });
    if (r.titreAnt === "oui" && !citoyenUE)
      Q.push({
        id: "dernierTitre",
        libelle: c.algerien ? "Votre dernier certificat de résidence" : "Votre dernier titre de séjour",
        type: "liste",
        options: c.algerien ? CERTIFICATS : TITRES,
        avec: { id: "finTitre", libelle: "Sa date d'expiration", type: "date" },
      });
  }

  if (c.algerien && !CAS_SANS_CERTIFICAT.includes(cas) && (p === "OQTF" || p === "REFUS_TITRE" || blocage || p === "REFUS_IMPLICITE" || p === "DIAGNOSTIC")) {
    Q.push({
      id: "certificat",
      libelle: "Quel certificat de résidence est en cause ?",
      type: "choix",
      options: [
        ["vpf", "Un an, vie privée et familiale"],
        ["conjoint", "Conjoint de Français"],
        ["parent", "Parent d'enfant français"],
        ["dix", "Dix ans"],
        ["salarie", "Salarié"],
        ["etudiant", "Étudiant"],
        ["autre", "Autre ou je ne sais pas"],
      ],
    });
  }

  if (p === "OQTF") {
    Q.push({ id: "irtf", libelle: "La décision prononce-t-elle aussi une interdiction de retour en France ?", type: "oui_non" });
    // Le fondement de l'OQTF n'est demandé que si l'orientation ne l'a pas établi.
    if (!cas || cas === "OQTF_GENERALE" || cas === "LIBRE") Q.push({ id: "suiteRefus", libelle: "L'OQTF fait-elle suite à un refus de titre de séjour ?", type: "oui_non" });
  }

  if (p === "REFUS_TITRE" && CAS_HORS_TITRE.includes(cas)) {
    if (cas === "REFUS_REGROUPEMENT_FAMILIAL")
      Q.push({
        id: "beneficiaires",
        libelle: "Qui souhaitez-vous faire venir ?",
        type: "choix",
        options: [
          ["conjoint", "Mon conjoint"],
          ["enfants", "Mes enfants"],
          ["les_deux", "Mon conjoint et mes enfants"],
        ],
      });
  } else if (p === "REFUS_TITRE") {
    if (!CAS_TITRE_DETERMINE.includes(cas)) Q.push({
      id: "demande",
      libelle: "Il s'agissait :",
      type: "choix",
      options: [
        ["premiere", "D'une première demande"],
        ["renouvellement", "D'un renouvellement"],
      ],
    });
    if (!c.algerien && !CAS_FONDEMENT_CONNU.includes(cas))
      Q.push({
        id: "fondement",
        libelle: "Quel titre de séjour était en cause ?",
        type: "choix",
        options: [
          ["vpf", "Vie privée et familiale"],
          ["salarie", "Salarié ou travailleur temporaire"],
          ["etudiant", "Étudiant"],
          ["talent", "Passeport talent"],
          ["autre", "Autre"],
        ],
      });
  }

  if (p === "REFUS_VISA") {
    if (!MOTIF_VISA[cas]) Q.push({
      id: "motif",
      libelle: "Pour quel motif aviez-vous demandé le visa ?",
      type: "choix",
      options: [
        ["conjoint", "Rejoindre mon conjoint français"],
        ["famille", "Regroupement ou visite familiale"],
        ["etudes", "Études"],
        ["travail", "Travail"],
        ["tourisme", "Tourisme ou affaires"],
        ["autre", "Autre"],
      ],
    });
    Q.push({ id: "consulat", libelle: c.implicite ? "Quel consulat traite la demande de visa ?" : "Quel consulat a refusé le visa ?", type: "liste", options: CONSULATS, brut: true });
    Q.push({ id: "rapoForme", libelle: c.implicite ? "Avez-vous déjà formé vous-même un recours ?" : "Avez-vous déjà formé vous-même un recours contre ce refus ?", type: "oui_non" });
    Q.push({ id: "urgenceVisa", libelle: "Une séparation familiale ou une urgence particulière est-elle en jeu ?", type: "oui_non" });
  }

  if (p === "NATURALISATION") {
    Q.push({ id: "rapoForme", libelle: c.implicite ? "Avez-vous déjà écrit au ministre au sujet de l'absence de décision ?" : "Avez-vous déjà écrit au ministre pour contester cette décision ?", type: "oui_non" });
  }

  if (blocage || p === "REFUS_IMPLICITE") {
    if (!c.prefectureConnue) Q.push({ id: "prefecture", libelle: "Quelle préfecture est concernée ?", type: "liste", options: PREFECTURES.map(([, l]) => [l, l]), brut: true, aide: "Celle de votre département de résidence." });
    if (blocage) Q.push({ id: "depuis", libelle: "Depuis quand votre démarche est-elle bloquée ?", type: "date", aide: "Une date approximative suffit." });
  }

  if (sejour) {
    Q.push({
      id: "famille",
      libelle: "Votre situation familiale",
      type: "choix",
      options: FAMILLE,
    });
    if (["marie", "pacs", "concubinage"].includes(r.famille ?? ""))
      Q.push({
        id: "conjoint",
        libelle: "Votre conjoint est :",
        type: "choix",
        options: [
          ["francais", "Français(e)"],
          ["regulier", "Étranger en situation régulière"],
          ["sans_titre", "Étranger sans titre de séjour"],
        ],
      });
    Q.push({
      id: "enfants",
      libelle: "Combien d'enfants avez-vous ?",
      type: "choix",
      options: NOMBRES_ENFANTS,
      avec: { id: "enfantsFrance", libelle: "Vivent-ils en France ?", type: "oui_non" },
    });
    if (Number(r.enfants) > 0) Q.push({ id: "scolarises", libelle: "Sont-ils scolarisés en France ?", type: "oui_non" });
    Q.push({
      id: "activite",
      libelle: "Votre activité professionnelle",
      type: "choix",
      options: [
        ["cdi", "CDI"],
        ["cdd", "CDD"],
        ["interim", "Intérim"],
        ["independant", "Indépendant"],
        ["aucune", "Aucune activité"],
      ],
    });
    if (r.activite && r.activite !== "aucune")
      Q.push({
        id: "anciennete",
        libelle: "Depuis combien de temps ?",
        type: "choix",
        options: [
          ["moins1", "Moins d'un an"],
          ["1a3", "Un à trois ans"],
          ["plus3", "Plus de trois ans"],
        ],
      });
  }

  Q.push({ id: "precisions", libelle: "Un autre élément utile à votre dossier ?", type: "texte_long", facultative: true });
  return Q;
}

export interface PieceDemandee {
  type: string;
  libelle: string; // modèle en français, traduit à l'affichage
  pourquoi: string;
  vars?: Record<string, string | number>;
}

// Libellés des pièces communes aux fiches du référentiel (cas.ts) : rattachées aux types déjà connus du parcours.
const PIECE_DECISION = "La décision complète, toutes pages, y compris la mention des voies et délais de recours";
const PIECE_NOTIF = "L'enveloppe ou l'accusé de réception portant la date de notification";

export function piecesDemandees(c: Contexte, r: Reponses): PieceDemandee[] {
  const p = c.procedure;
  const L: PieceDemandee[] = [];
  const ajouter = (type: string, libelle: string, pourquoi: string, vars?: Record<string, string | number>) =>
    L.push({ type, libelle, pourquoi, vars });
  // Pièces du cas reconnu : elles remplacent les pièces propres à la procédure (décision, visa, blocage, demande…).
  const propres = (c.pieces ?? []).filter((x) => !/^passeport$/i.test(x.trim()));
  const avecCas = propres.length > 0;
  const cite = (re: RegExp) => propres.some((x) => re.test(x));
  const decision = !c.implicite && (["OQTF", "REFUS_TITRE", "REFUS_VISA", "NATURALISATION"].includes(p) || r.decisionRecue === "oui");

  if (avecCas) {
    propres.forEach((x, i) => {
      if (x === PIECE_DECISION) ajouter("DECISION", "La décision contestée (toutes les pages)", "Objet du recours");
      else if (x === PIECE_NOTIF) ajouter("ENVELOPPE", "L'enveloppe ou la preuve de notification", "Point de départ du délai");
      else ajouter(p === "BLOCAGE_EMPLOI" || p === "BLOCAGE_SIMPLE" ? `BLOCAGE_${i + 1}` : `CAS_${i + 1}`, x, "Pièce propre à votre situation");
    });
  } else if (decision) {
    ajouter("DECISION", "La décision contestée (toutes les pages)", "Objet du recours");
    ajouter("ENVELOPPE", "L'enveloppe ou la preuve de notification", "Point de départ du délai");
  }
  ajouter("IDENTITE", "Passeport ou pièce d'identité", "Identité et nationalité");
  if (p !== "REFUS_VISA" && c.cas !== "RETOUR_IMPOSSIBLE") ajouter("DOMICILE", "Justificatif de domicile récent", "Tribunal compétent");
  if (c.algerien && !CAS_SANS_CERTIFICAT.includes(c.cas ?? "") && p !== "REFUS_VISA" && p !== "NATURALISATION")
    ajouter("CERTIFICAT", "Certificat de résidence algérien détenu (recto verso)", "Accord franco-algérien de 1968");
  if (r.entree && ["OQTF", "REFUS_TITRE", "NATURALISATION", "DIAGNOSTIC", "REFUS_IMPLICITE"].includes(p)) {
    const debut = new Date(r.entree).getFullYear();
    const fin = new Date().getFullYear();
    if (debut && fin > debut)
      ajouter("PRESENCE", "Preuves de présence en France pour chaque année de {debut} à {fin}", "Ancienneté du séjour (deux ou trois documents datés par an)", { debut, fin });
  }
  if (r.titreAnt === "oui" && !cite(/titre de s[ée]jour|r[ée]c[ée]piss[ée]/i)) ajouter("TITRES", "Titres de séjour et récépissés antérieurs", "Historique administratif");
  if (r.famille === "marie" && !cite(/acte de mariage/i)) ajouter("MARIAGE", "Acte de mariage", "Vie familiale");
  if (r.famille === "pacs") ajouter("PACS", "Attestation de PACS", "Vie familiale");
  if (r.famille === "concubinage") ajouter("VIE_COMMUNE", "Preuves de vie commune", "Vie familiale");
  if (["marie", "pacs", "concubinage"].includes(r.famille ?? "")) ajouter("CONJOINT", "Pièce d'identité ou titre de séjour du conjoint", "Situation du conjoint");
  if (Number(r.enfants) > 0) {
    if (!cite(/naissance|[ée]tat civil/i)) ajouter("NAISSANCES", "Actes de naissance des enfants", "Liens familiaux");
    if (r.scolarises === "oui") ajouter("SCOLARITE", "Certificats de scolarité", "Intégration des enfants");
  }
  if (r.activite && r.activite !== "aucune" && !cite(/contrat|bulletins? de salaire/i)) {
    ajouter("CONTRAT", "Contrat de travail", "Insertion professionnelle");
    ajouter("SALAIRES", "Trois derniers bulletins de salaire", "Insertion professionnelle");
  }
  if (r.rapoForme === "oui") ajouter("RECOURS_FORME", "Le recours déjà envoyé et son accusé de réception", "Recevabilité");
  if (!avecCas) {
    if (p === "REFUS_VISA") {
      ajouter("DEMANDE_VISA", "Formulaire de demande de visa et récépissé", "Contenu de la demande");
      ajouter("OBJET_SEJOUR", "Justificatifs de l'objet du séjour", "Motif du séjour");
      ajouter("RESSOURCES", "Justificatifs de ressources et d'hébergement", "Conditions du séjour");
    }
    if (p === "BLOCAGE_EMPLOI" || p === "BLOCAGE_SIMPLE") {
      ajouter("BLOCAGE", "Captures d'écran datées des tentatives de rendez-vous, ou récépissé expiré", "Preuve du blocage");
      if (p === "BLOCAGE_EMPLOI") ajouter("EMPLOYEUR", "Attestation de l'employeur sur le risque de rupture", "Urgence");
    }
    if (p === "REFUS_IMPLICITE") ajouter("DEMANDE_DEPOSEE", "La demande déposée et son accusé de réception", "Point de départ du silence");
    if (p === "PROCEDURE_EN_COURS") {
      ajouter("ECRITURES", "La requête et les mémoires déjà déposés", "État de la procédure");
      ajouter("COURRIERS_TRIBUNAL", "Les derniers courriers du tribunal", "Prochaine échéance");
    }
  }
  return L;
}
