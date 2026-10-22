// Modèles d'actes du poste de travail de l'avocat.
// Chaque projet est une base de travail : l'avocat le relit, le complète et l'atteste avant tout dépôt.
// Toute information manquante est marquée XXX (surlignée en jaune à l'affichage et dans le fichier Word) :
// aucun dépôt n'est possible tant qu'il en reste une.

import { PROCEDURES, type CodeProcedure } from "./procedures";

export const MANQUANT = "XXX";

export type CodeModele =
  | "REQUETE_OQTF"
  | "REQUETE_REFUS_TITRE"
  | "REQUETE_SOMMAIRE"
  | "MEMOIRE_COMPLEMENTAIRE"
  | "REFERE_SUSPENSION"
  | "REFERE_LIBERTE"
  | "REFERE_MESURES_UTILES"
  | "RECOURS_GRACIEUX"
  | "RAPO_VISA"
  | "RAPO_NATURALISATION"
  | "MISE_EN_DEMEURE"
  | "AVIS_ECRIT";

export const LIBELLES_MODELE: Record<CodeModele, string> = {
  REQUETE_OQTF: "Requête en annulation · OQTF",
  REQUETE_REFUS_TITRE: "Requête en annulation · refus de titre de séjour",
  REQUETE_SOMMAIRE: "Requête sommaire (urgence) · mémoire complémentaire à suivre",
  MEMOIRE_COMPLEMENTAIRE: "Mémoire complémentaire",
  REFERE_SUSPENSION: "Référé-suspension (article L. 521-1 du CJA)",
  REFERE_LIBERTE: "Référé-liberté (article L. 521-2 du CJA)",
  REFERE_MESURES_UTILES: "Référé mesures utiles (article L. 521-3 du CJA)",
  RECOURS_GRACIEUX: "Recours gracieux au préfet",
  RAPO_VISA: "Recours préalable · refus de visa",
  RAPO_NATURALISATION: "Recours préalable · naturalisation",
  MISE_EN_DEMEURE: "Mise en demeure de la préfecture",
  AVIS_ECRIT: "Avis écrit au client",
};

/** Modèles proposés selon la procédure (le premier est celui de la mission). */
export function modelesPour(procedure: string, avisPrealable: boolean): CodeModele[] {
  if (avisPrealable) return ["AVIS_ECRIT"];
  switch (procedure as CodeProcedure) {
    case "OQTF":
      return ["REQUETE_OQTF", "REQUETE_SOMMAIRE", "MEMOIRE_COMPLEMENTAIRE"];
    case "REFUS_TITRE":
    case "REFUS_IMPLICITE":
      return ["REQUETE_REFUS_TITRE", "REFERE_SUSPENSION", "RECOURS_GRACIEUX", "REQUETE_SOMMAIRE", "MEMOIRE_COMPLEMENTAIRE"];
    case "REFUS_VISA":
      return ["RAPO_VISA"];
    case "NATURALISATION":
      return ["RAPO_NATURALISATION"];
    case "BLOCAGE_SIMPLE":
      return ["MISE_EN_DEMEURE", "REFERE_MESURES_UTILES"];
    case "BLOCAGE_EMPLOI":
      return ["REFERE_MESURES_UTILES", "REFERE_LIBERTE", "MISE_EN_DEMEURE"];
    case "PROCEDURE_EN_COURS":
      return ["MEMOIRE_COMPLEMENTAIRE", "REQUETE_REFUS_TITRE", "REQUETE_OQTF"];
    case "DIAGNOSTIC":
      return ["AVIS_ECRIT"];
    default:
      return ["REQUETE_REFUS_TITRE"];
  }
}

/** Actes juridictionnels : un tribunal compétent doit y figurer. */
export const JURIDICTIONNELS: CodeModele[] = [
  "REQUETE_OQTF",
  "REQUETE_REFUS_TITRE",
  "REQUETE_SOMMAIRE",
  "MEMOIRE_COMPLEMENTAIRE",
  "REFERE_SUSPENSION",
  "REFERE_LIBERTE",
  "REFERE_MESURES_UTILES",
];

// Tribunal administratif territorialement compétent (siège de l'autorité qui a pris la décision).
// Liste limitée à l'Île-de-France ; ailleurs, XXX : l'avocat complète.
const TRIBUNAUX: [RegExp, string][] = [
  [/police|paris\b|\b75\b/i, "Paris"],
  [/seine-saint-denis|bobigny|\b93\b/i, "Montreuil"],
  [/val-de-marne|cr[ée]teil|\b94\b/i, "Melun"],
  [/seine-et-marne|melun|\b77\b/i, "Melun"],
  [/hauts-de-seine|nanterre|\b92\b/i, "Cergy-Pontoise"],
  [/val-d'oise|val d'oise|cergy|\b95\b/i, "Cergy-Pontoise"],
  [/essonne|[ée]vry|\b91\b/i, "Versailles"],
  [/yvelines|versailles|\b78\b/i, "Versailles"],
];

export function tribunalCompetent(prefecture?: string | null): string {
  if (!prefecture) return MANQUANT;
  return TRIBUNAUX.find(([re]) => re.test(prefecture))?.[1] ?? MANQUANT;
}

export interface DonneesActe {
  civilite?: string | null;
  prenom?: string | null;
  nom?: string | null;
  procedure: string;
  algerien?: boolean | null;
  prefecture?: string | null;
  dateDecision?: string | null;
  dateNotification?: string | null;
  dateLimite?: string | null;
  situationOQTF?: string | null;
  reponses: Record<string, string | undefined>;
  question?: string | null;
  avocat: { prenom: string; nom: string } | null;
  pieces: string[];
  reference: string;
}

/** « Préfecture du Val-de-Marne » → « préfet du Val-de-Marne » ; « Préfecture de police » → « préfet de police ». */
export function prefet(prefecture?: string | null, majuscule = false): string {
  const p = (prefecture ?? "").trim();
  let r: string;
  if (!p) r = `préfet de ${MANQUANT}`;
  else {
    const m = p.match(/^pr[ée]fecture\s+(de la|de l'|du|des|de|d')\s*(.+)$/i);
    r = m ? `préfet ${m[1].toLowerCase()}${m[1].endsWith("'") ? "" : " "}${m[2]}` : /^pr[ée]f/i.test(p) ? p.replace(/^pr[ée]fecture/i, "préfet") : `préfet de ${p}`;
  }
  return majuscule ? r.charAt(0).toUpperCase() + r.slice(1) : r;
}

const fr = (iso?: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join("/") : MANQUANT);
const v = (x?: string | null) => (x && x.trim() ? x.trim() : MANQUANT);

const FAMILLE: Record<string, string> = {
  celibataire: "célibataire",
  marie: "marié(e)",
  pacs: "lié(e) par un pacte civil de solidarité",
  concubinage: "vit en concubinage",
  separe: "divorcé(e) ou séparé(e)",
};
const ACTIVITE: Record<string, string> = {
  cdi: "salarié(e) en contrat à durée indéterminée",
  cdd: "salarié(e) en contrat à durée déterminée",
  interim: "travaille en intérim",
  independant: "exerce une activité indépendante",
  etudiant: "est étudiant(e)",
  sans: "est sans activité professionnelle",
};

function identite(d: DonneesActe) {
  const civ = d.civilite === "MADAME" ? "Madame" : d.civilite === "MONSIEUR" ? "Monsieur" : MANQUANT;
  return `${civ} ${v(d.prenom)} ${(d.nom ?? MANQUANT).toUpperCase()}`;
}

function avocatConstitue(d: DonneesActe) {
  const nom = d.avocat ? `Maître ${d.avocat.prenom} ${d.avocat.nom}` : `Maître ${MANQUANT}`;
  return `${nom}, avocat au barreau de Paris, SELARL VARTIS Avocats (Lexpatria Avocats), 222 boulevard Saint-Germain, 75007 Paris`;
}

function signature(d: DonneesActe) {
  return `Fait à Paris, le ${MANQUANT}\n\n${d.avocat ? `Maître ${d.avocat.prenom} ${d.avocat.nom}` : `Maître ${MANQUANT}`}\nAvocat au barreau de Paris`;
}

function faits(d: DonneesActe) {
  const r = d.reponses;
  const lignes: string[] = [];
  lignes.push(`${identite(d)} est entré(e) en France le ${fr(r.entree)}${r.modeEntree ? ` (${r.modeEntree})` : ""}.`);
  if (r.titreAnt === "oui") lignes.push(`Il/elle a été titulaire d'un titre de séjour (${v(r.dernierTitre)}), expiré le ${fr(r.finTitre)}.`);
  if (r.famille) lignes.push(`Sur le plan familial, il/elle est ${FAMILLE[r.famille] ?? r.famille}${r.conjoint ? ` ; son conjoint ${r.conjoint}` : ""}.`);
  if (r.enfants && r.enfants !== "0") lignes.push(`Il/elle a ${r.enfants} enfant(s)${r.scolarises === "oui" ? ", scolarisé(s) en France" : ""}.`);
  if (r.activite) lignes.push(`Il/elle ${ACTIVITE[r.activite] ?? r.activite}${r.anciennete ? ` depuis ${r.anciennete}` : ""}.`);
  lignes.push(
    `Par une décision du ${fr(d.dateDecision)}, notifiée le ${fr(d.dateNotification)}, le ${prefet(d.prefecture)} a ${objetDecision(d)}.`,
  );
  if (r.precisions) lignes.push(r.precisions);
  lignes.push("C'est la décision attaquée.");
  return lignes.join("\n");
}

function objetDecision(d: DonneesActe) {
  switch (d.procedure) {
    case "OQTF":
      return `obligé ${identite(d)} à quitter le territoire français${d.situationOQTF === "LIBRE" ? " dans un délai de trente jours" : ` (${MANQUANT} : délai de départ volontaire)`}, et fixé le pays de destination`;
    case "REFUS_IMPLICITE":
      return `implicitement rejeté la demande de titre de séjour présentée le ${fr(d.reponses.demande)}`;
    default:
      return `refusé de délivrer ${d.reponses.titreAnt === "oui" ? "le renouvellement du" : "un"} titre de séjour à ${identite(d)}`;
  }
}

function moyensLegaliteExterne() {
  return `A. Sur la légalité externe

1. Sur l'incompétence de l'auteur de l'acte
La décision attaquée a été signée par ${MANQUANT}. Il n'est pas justifié d'une délégation de signature régulièrement publiée et en vigueur à la date de la décision.

2. Sur l'insuffisance de motivation
La décision ne comporte pas l'énoncé des considérations de droit et de fait qui en constituent le fondement, en méconnaissance des articles L. 211-2 et L. 211-5 du code des relations entre le public et l'administration.

3. Sur le défaut d'examen particulier
Il ne ressort pas de la décision que le préfet ait procédé à un examen particulier de la situation personnelle de l'intéressé(e), notamment ${MANQUANT}.`;
}

function moyensVieFamiliale(d: DonneesActe) {
  const r = d.reponses;
  const parts = [
    `Sur la méconnaissance de l'article 8 de la convention européenne de sauvegarde des droits de l'homme et des libertés fondamentales
L'intéressé(e) réside en France depuis le ${fr(r.entree)} et y a fixé le centre de ses intérêts privés et familiaux : ${MANQUANT}. La décision porte à son droit au respect de sa vie privée et familiale une atteinte disproportionnée aux buts en vue desquels elle a été prise.`,
  ];
  if (r.enfants && r.enfants !== "0")
    parts.push(`Sur la méconnaissance de l'article 3-1 de la convention internationale des droits de l'enfant
Les enfants de l'intéressé(e)${r.scolarises === "oui" ? ", scolarisés en France," : ""} seraient séparés de leur parent ou contraints de quitter leur environnement. L'intérêt supérieur de l'enfant n'a pas été pris en compte : ${MANQUANT}.`);
  if (d.algerien)
    parts.push(`Sur la méconnaissance de l'accord franco-algérien du 27 décembre 1968
Ressortissant(e) algérien(ne), l'intéressé(e) relève des stipulations de l'accord franco-algérien, notamment de son article ${MANQUANT}, que la décision méconnaît.`);
  parts.push(`Sur l'erreur manifeste d'appréciation
Compte tenu de l'ensemble des éléments de sa situation (${MANQUANT}), la décision est entachée d'une erreur manifeste dans l'appréciation de ses conséquences sur la situation personnelle de l'intéressé(e).`);
  return parts.map((p, i) => `${i + 4}. ${p}`).join("\n\n");
}

function conclusionsAnnulation(d: DonneesActe, oqtf: boolean) {
  return `PAR CES MOTIFS,
et tous autres à produire, déduire ou suppléer, au besoin d'office, ${identite(d)} demande au tribunal de :
— annuler la décision ${oqtf ? "portant obligation de quitter le territoire français, ensemble les décisions fixant le délai de départ volontaire et le pays de destination" : "attaquée"} ;
— enjoindre au ${prefet(d.prefecture)} de ${oqtf ? "réexaminer sa situation et de lui délivrer une autorisation provisoire de séjour dans l'attente" : "lui délivrer un titre de séjour ou, à défaut, de réexaminer sa situation"} dans un délai de ${MANQUANT} à compter de la notification du jugement, sous astreinte de ${MANQUANT} euros par jour de retard ;
— mettre à la charge de l'État la somme de ${MANQUANT} euros au titre de l'article L. 761-1 du code de justice administrative.`;
}

function bordereau(d: DonneesActe) {
  const liste = ["Décision attaquée", ...d.pieces.filter((p) => !/d[ée]cision attaqu/i.test(p))];
  return `BORDEREAU DES PIÈCES\n${liste.map((p, i) => `Pièce n° ${i + 1} : ${p}`).join("\n")}`;
}

function enTete(d: DonneesActe, titre: string, sousTitre: string) {
  return `TRIBUNAL ADMINISTRATIF DE ${tribunalCompetent(d.prefecture).toUpperCase()}

${titre}
${sousTitre}

POUR : ${identite(d)}, né(e) le ${MANQUANT} à ${MANQUANT}, de nationalité ${MANQUANT}, demeurant ${MANQUANT}

Ayant pour avocat : ${avocatConstitue(d)}

CONTRE : la décision du ${prefet(d.prefecture)} du ${fr(d.dateDecision)}`;
}

export function genererModele(code: CodeModele, d: DonneesActe): string {
  switch (code) {
    case "REQUETE_OQTF":
      return `${enTete(d, "REQUÊTE EN ANNULATION", "(articles L. 614-1 et suivants du code de l'entrée et du séjour des étrangers et du droit d'asile)")}

I. FAITS ET PROCÉDURE

${faits(d)}

II. DISCUSSION

${moyensLegaliteExterne()}

B. Sur la légalité interne

${d.reponses.titreAnt === "oui" || d.reponses.demande ? `Sur l'exception d'illégalité de la décision de refus de séjour
La décision portant obligation de quitter le territoire est privée de base légale en conséquence de l'illégalité du refus de séjour qui la fonde : ${MANQUANT}.

` : ""}Sur la méconnaissance de l'article L. 611-3 du code de l'entrée et du séjour des étrangers et du droit d'asile
${MANQUANT} : vérifier si l'intéressé(e) relève d'une catégorie protégée contre l'éloignement.

${moyensVieFamiliale(d)}

Sur la décision fixant le pays de destination
Elle est illégale par voie de conséquence et méconnaît l'article 3 de la convention européenne des droits de l'homme : ${MANQUANT}.

${conclusionsAnnulation(d, true)}

${signature(d)}

${bordereau(d)}`;

    case "REQUETE_REFUS_TITRE":
      return `${enTete(d, "REQUÊTE EN ANNULATION", "(article R. 421-1 du code de justice administrative)")}

I. FAITS ET PROCÉDURE

${faits(d)}

II. DISCUSSION

${moyensLegaliteExterne()}

B. Sur la légalité interne

Sur la méconnaissance des conditions du titre demandé
L'intéressé(e) remplit les conditions de délivrance du titre sollicité (${v(d.reponses.fondement)}) : ${MANQUANT}.

${moyensVieFamiliale(d)}

${conclusionsAnnulation(d, false)}

${signature(d)}

${bordereau(d)}`;

    case "REQUETE_SOMMAIRE":
      return `${enTete(d, "REQUÊTE SOMMAIRE", "Un mémoire complémentaire sera produit dans un délai de quinze jours.")}

I. FAITS

${faits(d)}

II. DISCUSSION

La décision attaquée est entachée d'illégalité externe (incompétence, insuffisance de motivation, défaut d'examen particulier) et d'illégalité interne (méconnaissance de l'article 8 de la convention européenne des droits de l'homme, erreur manifeste d'appréciation). Ces moyens seront développés dans le mémoire complémentaire.

${conclusionsAnnulation(d, d.procedure === "OQTF")}

${signature(d)}`;

    case "MEMOIRE_COMPLEMENTAIRE":
      return `TRIBUNAL ADMINISTRATIF DE ${tribunalCompetent(d.prefecture).toUpperCase()}
Requête n° ${MANQUANT}

MÉMOIRE COMPLÉMENTAIRE

POUR : ${identite(d)}
Ayant pour avocat : ${avocatConstitue(d)}
CONTRE : ${prefet(d.prefecture)}

En complément de sa requête enregistrée le ${MANQUANT}, ${identite(d)} développe les moyens suivants.

${moyensLegaliteExterne()}

B. Sur la légalité interne

${moyensVieFamiliale(d)}

Persistant dans ses précédentes conclusions.

${signature(d)}`;

    case "REFERE_SUSPENSION":
      return `${enTete(d, "REQUÊTE EN RÉFÉRÉ-SUSPENSION", "(article L. 521-1 du code de justice administrative)")}

La requête en annulation de la décision attaquée a été enregistrée le ${MANQUANT} sous le numéro ${MANQUANT}.

I. SUR L'URGENCE
La décision prive l'intéressé(e) de ${MANQUANT} (droit au séjour, emploi, ressources). L'urgence est caractérisée : ${MANQUANT}.

II. SUR LE DOUTE SÉRIEUX QUANT À LA LÉGALITÉ DE LA DÉCISION
Les moyens développés dans la requête au fond, et notamment ${MANQUANT}, sont de nature à créer un doute sérieux quant à la légalité de la décision.

PAR CES MOTIFS, il est demandé au juge des référés de :
— suspendre l'exécution de la décision attaquée ;
— enjoindre au ${prefet(d.prefecture)} de réexaminer la situation et de délivrer une autorisation provisoire de séjour dans un délai de ${MANQUANT} ;
— mettre à la charge de l'État la somme de ${MANQUANT} euros au titre de l'article L. 761-1 du code de justice administrative.

${signature(d)}

${bordereau(d)}`;

    case "REFERE_LIBERTE":
      return `${enTete(d, "REQUÊTE EN RÉFÉRÉ-LIBERTÉ", "(article L. 521-2 du code de justice administrative)")}

I. FAITS
${faits(d)}

II. SUR L'URGENCE PARTICULIÈRE
${MANQUANT} : perte imminente de l'emploi, rupture des droits, impossibilité de justifier de la régularité du séjour.

III. SUR L'ATTEINTE GRAVE ET MANIFESTEMENT ILLÉGALE À UNE LIBERTÉ FONDAMENTALE
${MANQUANT}

PAR CES MOTIFS, il est demandé au juge des référés d'enjoindre au ${prefet(d.prefecture)} de ${MANQUANT} dans un délai de ${MANQUANT} heures, sous astreinte, et de mettre à la charge de l'État la somme de ${MANQUANT} euros au titre de l'article L. 761-1 du code de justice administrative.

${signature(d)}

${bordereau(d)}`;

    case "REFERE_MESURES_UTILES":
      return `${enTete(d, "REQUÊTE EN RÉFÉRÉ « MESURES UTILES »", "(article L. 521-3 du code de justice administrative)")}

I. FAITS
${identite(d)} a sollicité ${MANQUANT} auprès de la ${v(d.prefecture).toLowerCase().startsWith("préfecture") ? v(d.prefecture).replace(/^P/, "p") : "préfecture de " + v(d.prefecture)} le ${fr(d.reponses.demande)}. Malgré ${MANQUANT} (demandes de rendez-vous, mise en demeure du ${MANQUANT}), aucune suite n'a été donnée.

II. SUR L'URGENCE ET L'UTILITÉ DE LA MESURE
${MANQUANT}

III. SUR L'ABSENCE DE CONTESTATION SÉRIEUSE ET D'OBSTACLE À L'EXÉCUTION D'UNE DÉCISION ADMINISTRATIVE
${MANQUANT}

PAR CES MOTIFS, il est demandé au juge des référés d'enjoindre au ${prefet(d.prefecture)} de ${MANQUANT} (fixer un rendez-vous, délivrer un récépissé) dans un délai de ${MANQUANT}, sous astreinte de ${MANQUANT} euros par jour de retard, et de mettre à la charge de l'État la somme de ${MANQUANT} euros au titre de l'article L. 761-1 du code de justice administrative.

${signature(d)}

${bordereau(d)}`;

    case "RECOURS_GRACIEUX":
      return `LEXPATRIA Avocats — SELARL VARTIS Avocats
222 boulevard Saint-Germain, 75007 Paris

Monsieur le ${prefet(d.prefecture, true)}
${MANQUANT} (adresse du service des étrangers)

Lettre recommandée avec demande d'avis de réception
Paris, le ${MANQUANT}

Objet : recours gracieux contre la décision du ${fr(d.dateDecision)} — ${identite(d)}
Réf. : ${d.reference}

Monsieur le Préfet,

En ma qualité de conseil de ${identite(d)}, j'ai l'honneur de former un recours gracieux contre votre décision du ${fr(d.dateDecision)}, notifiée le ${fr(d.dateNotification)}.

${faits(d)}

Cette décision ne tient pas compte de ${MANQUANT}. Je vous demande en conséquence de bien vouloir la retirer et de ${MANQUANT}.

Je vous prie d'agréer, Monsieur le Préfet, l'expression de ma haute considération.

${signature(d)}`;

    case "RAPO_VISA":
      return `LEXPATRIA Avocats — SELARL VARTIS Avocats
222 boulevard Saint-Germain, 75007 Paris

Commission de recours contre les décisions de refus de visa d'entrée en France (CRRV)
BP 83609
44036 Nantes Cedex 01

Lettre recommandée avec demande d'avis de réception
Paris, le ${MANQUANT}

Objet : recours administratif préalable obligatoire contre le refus de visa ${v(d.reponses.consulat ? `opposé par ${d.reponses.consulat}` : "")} du ${fr(d.dateDecision)}
Demandeur : ${identite(d)}
Réf. : ${d.reference}

Madame, Monsieur les membres de la commission,

En ma qualité de conseil de ${identite(d)}, j'ai l'honneur de former un recours contre la décision du ${fr(d.dateDecision)} par laquelle ${v(d.reponses.consulat)} a refusé de lui délivrer un visa ${v(d.reponses.motif)}.

I. Les faits
${MANQUANT}

II. Les motifs du refus et leur contestation
Le refus est fondé sur ${MANQUANT}. Ce motif est erroné : ${MANQUANT}.

III. Le droit au respect de la vie privée et familiale
${MANQUANT}

Je vous demande en conséquence de bien vouloir recommander la délivrance du visa sollicité.

Pièces jointes : voir bordereau.

${signature(d)}

${bordereau(d)}`;

    case "RAPO_NATURALISATION":
      return `LEXPATRIA Avocats — SELARL VARTIS Avocats
222 boulevard Saint-Germain, 75007 Paris

Monsieur le Ministre de l'Intérieur
Direction générale des étrangers en France
Direction de l'intégration et de l'accès à la nationalité
Sous-direction de l'accès à la nationalité française (SDANF)
12 rue Francis-Le-Carval
44404 Rezé Cedex

Lettre recommandée avec demande d'avis de réception
Paris, le ${MANQUANT}

Objet : recours administratif préalable contre la décision du ${fr(d.dateDecision)} — ${identite(d)}
Réf. : ${d.reference}

Monsieur le Ministre,

En ma qualité de conseil de ${identite(d)}, j'ai l'honneur de former un recours contre la décision du ${fr(d.dateDecision)} ${MANQUANT} (refus ou ajournement) de sa demande de naturalisation.

I. La situation de l'intéressé(e)
${MANQUANT} (résidence, insertion professionnelle, assimilation, situation familiale)

II. La contestation du motif retenu
La décision est fondée sur ${MANQUANT}. Ce motif ne saurait être retenu : ${MANQUANT}.

Je vous demande en conséquence de bien vouloir reconsidérer cette décision.

${signature(d)}

${bordereau(d)}`;

    case "MISE_EN_DEMEURE":
      return `LEXPATRIA Avocats — SELARL VARTIS Avocats
222 boulevard Saint-Germain, 75007 Paris

Monsieur le ${prefet(d.prefecture, true)}
${MANQUANT} (adresse du service des étrangers)

Lettre recommandée avec demande d'avis de réception
Paris, le ${MANQUANT}

Objet : mise en demeure — ${identite(d)}
Réf. : ${d.reference}

Monsieur le Préfet,

Je vous écris en ma qualité de conseil de ${identite(d)}.

Mon client(e) ${MANQUANT} (sollicite en vain un rendez-vous depuis le…, n'a pas reçu de récépissé…). ${d.procedure === "BLOCAGE_EMPLOI" ? "Cette situation menace directement son emploi : " + MANQUANT + "." : ""}

Je vous mets en demeure de ${MANQUANT} dans un délai de ${MANQUANT} jours à compter de la réception de la présente. À défaut, je saisirai le juge des référés du tribunal administratif de ${tribunalCompetent(d.prefecture)}.

Je vous prie d'agréer, Monsieur le Préfet, l'expression de ma haute considération.

${signature(d)}`;

    case "AVIS_ECRIT":
      return `LEXPATRIA Avocats — SELARL VARTIS Avocats
Avis écrit — ${identite(d)}
Réf. : ${d.reference}

Vous nous avez demandé un avis sur la question suivante :
« ${v(d.question)} »

Cadrage
${MANQUANT} (situation retenue, textes applicables)

Analyse
${MANQUANT}

Conclusion
${MANQUANT}

Points d'attention
— ${MANQUANT}

${signature(d)}`;
  }
}

export function compterManquants(texte: string): number {
  return (texte.match(/XXX/g) ?? []).length;
}

/** Nombre de mots qui diffèrent entre deux textes (approximation par multiensembles de mots). */
export function motsModifies(avant: string, apres: string): number {
  const compte = (t: string) => {
    const m = new Map<string, number>();
    for (const w of t.toLowerCase().split(/\s+/).filter(Boolean)) m.set(w, (m.get(w) ?? 0) + 1);
    return m;
  };
  const a = compte(avant);
  const b = compte(apres);
  let diff = 0;
  for (const [w, n] of b) diff += Math.max(0, n - (a.get(w) ?? 0));
  for (const [w, n] of a) diff += Math.max(0, n - (b.get(w) ?? 0));
  return Math.ceil(diff / 2);
}

export const procedureLibelle = (p: string) => PROCEDURES[p as CodeProcedure]?.libelle ?? p;
