// Questionnaire et liste de pièces adaptés à la situation (cahier des charges, 4.7, 4.9, 6.0 et 6.2).
// Utilisé avant le paiement pour l'avis préalable et le diagnostic, après le paiement pour les procédures.
// Une question par écran ; deux au plus, seulement si elles sont de même nature (champ `avec`).

import type { CodeProcedure } from "./procedures";

export type Reponses = Record<string, string | undefined>;

export interface Question {
  id: string;
  libelle: string;
  type: "date" | "texte" | "texte_long" | "oui_non" | "choix" | "nombre";
  options?: [string, string][];
  aide?: string;
  /** Question de même nature affichée sur le même écran. */
  avec?: Question;
  facultative?: boolean;
}

export interface Contexte {
  procedure: CodeProcedure;
  algerien: boolean | null;
  avisOuDiagnostic: boolean;
}

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
        type: "choix",
        options: [
          ["long", "Visa long séjour"],
          ["court", "Visa court séjour"],
          ["sans", "Sans visa"],
          ["nsp", "Je ne sais pas"],
        ],
      },
    });
    Q.push({ id: "titreAnt", libelle: "Avez-vous déjà eu un titre de séjour en France ?", type: "oui_non" });
    if (r.titreAnt === "oui")
      Q.push({
        id: "dernierTitre",
        libelle: c.algerien ? "Votre dernier certificat de résidence" : "Votre dernier titre de séjour",
        type: "texte",
        aide: "Sa nature, par exemple « vie privée et familiale ».",
        avec: { id: "finTitre", libelle: "Sa date d'expiration", type: "date" },
      });
  }

  if (c.algerien && (p === "OQTF" || p === "REFUS_TITRE" || blocage || p === "REFUS_IMPLICITE" || p === "DIAGNOSTIC")) {
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
    Q.push({ id: "suiteRefus", libelle: "L'OQTF fait-elle suite à un refus de titre de séjour ?", type: "oui_non" });
  }

  if (p === "REFUS_TITRE") {
    Q.push({
      id: "demande",
      libelle: "Il s'agissait :",
      type: "choix",
      options: [
        ["premiere", "D'une première demande"],
        ["renouvellement", "D'un renouvellement"],
      ],
    });
    if (!c.algerien)
      Q.push({
        id: "fondement",
        libelle: "Quel titre aviez-vous demandé ?",
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
    Q.push({
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
    Q.push({ id: "consulat", libelle: "Quel consulat a refusé le visa ?", type: "texte", aide: "Par exemple : Alger, Casablanca, Tunis." });
    Q.push({ id: "rapoForme", libelle: "Avez-vous déjà formé vous-même un recours contre ce refus ?", type: "oui_non" });
    Q.push({ id: "urgenceVisa", libelle: "Une séparation familiale ou une urgence particulière est-elle en jeu ?", type: "oui_non" });
  }

  if (p === "NATURALISATION") {
    Q.push({ id: "rapoForme", libelle: "Avez-vous déjà écrit au ministre pour contester cette décision ?", type: "oui_non" });
  }

  if (blocage || p === "REFUS_IMPLICITE") {
    Q.push({ id: "prefecture", libelle: "Quelle préfecture est concernée ?", type: "texte", aide: "Par exemple : Seine-Saint-Denis (Bobigny)." });
    if (blocage) Q.push({ id: "depuis", libelle: "Depuis quand essayez-vous d'obtenir un rendez-vous ou un récépissé ?", type: "date", aide: "Une date approximative suffit." });
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
      type: "nombre",
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

export function piecesDemandees(c: Contexte, r: Reponses): PieceDemandee[] {
  const p = c.procedure;
  const L: PieceDemandee[] = [];
  const ajouter = (type: string, libelle: string, pourquoi: string, vars?: Record<string, string | number>) =>
    L.push({ type, libelle, pourquoi, vars });
  const decision = ["OQTF", "REFUS_TITRE", "REFUS_VISA", "NATURALISATION"].includes(p) || r.decisionRecue === "oui";

  if (decision) {
    ajouter("DECISION", "La décision contestée (toutes les pages)", "Objet du recours");
    ajouter("ENVELOPPE", "L'enveloppe ou la preuve de notification", "Point de départ du délai");
  }
  ajouter("IDENTITE", "Passeport ou pièce d'identité", "Identité et nationalité");
  if (p !== "REFUS_VISA") ajouter("DOMICILE", "Justificatif de domicile récent", "Tribunal compétent");
  if (c.algerien) ajouter("CERTIFICAT", "Certificat de résidence algérien détenu (recto verso)", "Accord franco-algérien de 1968");
  if (r.entree && ["OQTF", "REFUS_TITRE", "NATURALISATION", "DIAGNOSTIC", "REFUS_IMPLICITE"].includes(p)) {
    const debut = new Date(r.entree).getFullYear();
    const fin = new Date().getFullYear();
    if (debut && fin > debut)
      ajouter("PRESENCE", "Preuves de présence en France pour chaque année de {debut} à {fin}", "Ancienneté du séjour (deux ou trois documents datés par an)", { debut, fin });
  }
  if (r.titreAnt === "oui") ajouter("TITRES", "Titres de séjour et récépissés antérieurs", "Historique administratif");
  if (r.famille === "marie") ajouter("MARIAGE", "Acte de mariage", "Vie familiale");
  if (r.famille === "pacs") ajouter("PACS", "Attestation de PACS", "Vie familiale");
  if (r.famille === "concubinage") ajouter("VIE_COMMUNE", "Preuves de vie commune", "Vie familiale");
  if (["marie", "pacs", "concubinage"].includes(r.famille ?? "")) ajouter("CONJOINT", "Pièce d'identité ou titre de séjour du conjoint", "Situation du conjoint");
  if (Number(r.enfants) > 0) {
    ajouter("NAISSANCES", "Actes de naissance des enfants", "Liens familiaux");
    if (r.scolarises === "oui") ajouter("SCOLARITE", "Certificats de scolarité", "Intégration des enfants");
  }
  if (r.activite && r.activite !== "aucune") {
    ajouter("CONTRAT", "Contrat de travail", "Insertion professionnelle");
    ajouter("SALAIRES", "Trois derniers bulletins de salaire", "Insertion professionnelle");
  }
  if (p === "REFUS_VISA") {
    ajouter("DEMANDE_VISA", "Formulaire de demande de visa et récépissé", "Contenu de la demande");
    ajouter("OBJET_SEJOUR", "Justificatifs de l'objet du séjour", "Motif du séjour");
    ajouter("RESSOURCES", "Justificatifs de ressources et d'hébergement", "Conditions du séjour");
  }
  if (r.rapoForme === "oui") ajouter("RECOURS_FORME", "Le recours déjà envoyé et son accusé de réception", "Recevabilité");
  if (p === "BLOCAGE_EMPLOI" || p === "BLOCAGE_SIMPLE") {
    ajouter("BLOCAGE", "Captures d'écran datées des tentatives de rendez-vous, ou récépissé expiré", "Preuve du blocage");
    if (p === "BLOCAGE_EMPLOI") ajouter("EMPLOYEUR", "Attestation de l'employeur sur le risque de rupture", "Urgence");
  }
  if (p === "REFUS_IMPLICITE") ajouter("DEMANDE_DEPOSEE", "La demande déposée et son accusé de réception", "Point de départ du silence");
  if (p === "PROCEDURE_EN_COURS") {
    ajouter("ECRITURES", "La requête et les mémoires déjà déposés", "État de la procédure");
    ajouter("COURRIERS_TRIBUNAL", "Les derniers courriers du tribunal", "Prochaine échéance");
  }
  return L;
}
