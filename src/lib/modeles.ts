// Modèles d'actes du poste de travail de l'avocat.
// Chaque projet est une base de travail : l'avocat le relit, le complète et l'atteste avant tout dépôt.
// Toute information manquante est marquée XXX (surlignée en jaune à l'affichage et dans le fichier Word) :
// aucun dépôt n'est possible tant qu'il en reste une.

import { CERTIFICATS, CONSULATS, TITRES, VISAS_ENTREE } from "./listes";
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
  | "AVIS_ECRIT"
  | "REQUETE_APPEL";

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
  REQUETE_APPEL: "Requête d'appel devant la cour administrative d'appel",
};

/** Modèles proposés selon la procédure (le premier est celui de la mission). */
export function modelesPour(procedure: string, avisPrealable: boolean, appel = false): CodeModele[] {
  if (avisPrealable) return ["AVIS_ECRIT"];
  if (appel) return ["REQUETE_APPEL", "MEMOIRE_COMPLEMENTAIRE"];
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
  "REQUETE_APPEL",
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

/** Cour administrative d'appel compétente selon le tribunal de première instance (Île-de-France). */
export function courAppel(tribunal?: string | null): string {
  const t = (tribunal ?? "").toLowerCase();
  if (/paris|melun|montreuil/.test(t)) return "Paris";
  if (/cergy|versailles/.test(t)) return "Versailles";
  return MANQUANT;
}

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
  /** Adresse postale du client sur une ligne. */
  adresse?: string | null;
  dateNaissance?: string | null;
  nationalite?: string | null;
  /** Dossier d'appel : jugement attaqué (date du jugement = dateDecision, notification = dateNotification). */
  appel?: { tribunal: string; numero?: string | null; referencePremiere: string } | null;
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
// Réponses choisies dans une liste : code → libellé lisible dans l'acte.
const libelleListe = (liste: [string, string][], code?: string) => liste.find(([c]) => c === code)?.[1];
const visaEntree = (code?: string) => {
  if (!code || code === "nsp") return "";
  if (code === "sans") return " sans visa";
  const l = libelleListe(VISAS_ENTREE, code);
  return l ? `, muni(e) d'un ${l.charAt(0).toLowerCase()}${l.slice(1)}` : ` (${code})`;
};
const consulat = (code?: string) => {
  const l = libelleListe(CONSULATS, code);
  if (!l || code === "autre") return code && !l ? code : MANQUANT;
  return `les autorités consulaires françaises à ${l.split(" — ")[1] ?? l}`;
};

const FAMILLE: Record<string, string> = {
  celibataire: "célibataire",
  marie: "marié(e)",
  pacs: "lié(e) par un pacte civil de solidarité",
  concubinage: "vit en concubinage",
  separe: "divorcé(e) ou séparé(e)",
};
const CONJOINT: Record<string, string> = {
  francais: "est de nationalité française",
  regulier: "séjourne régulièrement en France",
  sans_titre: "est dépourvu de titre de séjour",
};
const ANCIENNETE: Record<string, string> = {
  moins1: "depuis moins d'un an",
  "1a3": "depuis un à trois ans",
  plus3: "depuis plus de trois ans",
};
const ACTIVITE: Record<string, string> = {
  cdi: "est salarié(e) en contrat à durée indéterminée",
  cdd: "est salarié(e) en contrat à durée déterminée",
  interim: "travaille en intérim",
  independant: "exerce une activité indépendante",
  etudiant: "est étudiant(e)",
  sans: "est sans activité professionnelle",
  aucune: "est sans activité professionnelle",
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
  lignes.push(`${identite(d)} est entré(e) en France le ${fr(r.entree)}${visaEntree(r.modeEntree)}.`);
  if (r.titreAnt === "oui") lignes.push(`Il/elle a été titulaire d'un titre de séjour (${v(libelleListe([...TITRES, ...CERTIFICATS], r.dernierTitre) ?? r.dernierTitre)}), expiré le ${fr(r.finTitre)}.`);
  if (r.famille) lignes.push(`Sur le plan familial, il/elle est ${FAMILLE[r.famille] ?? r.famille}${r.conjoint ? ` ; son conjoint ${CONJOINT[r.conjoint] ?? r.conjoint}` : ""}.`);
  if (r.enfants && r.enfants !== "0") {
    const un = r.enfants === "1";
    lignes.push(`Il/elle a ${un ? "un enfant" : `${r.enfants} enfants`}${r.scolarises === "oui" ? (un ? ", scolarisé en France" : ", scolarisés en France") : ""}.`);
  }
  if (r.activite) lignes.push(`Il/elle ${ACTIVITE[r.activite] ?? r.activite}${r.anciennete && r.activite !== "aucune" ? ` ${ANCIENNETE[r.anciennete] ?? `depuis ${r.anciennete}`}` : ""}.`);
  const blocage = d.procedure === "BLOCAGE_EMPLOI" || d.procedure === "BLOCAGE_SIMPLE";
  if (blocage)
    lignes.push(
      `Le ${fr(r.demande)}, il/elle a présenté une demande ${r.titreAnt === "oui" ? "de renouvellement de son titre de séjour" : "de titre de séjour"} auprès de la ${v(d.prefecture).replace(/^P/, "p")}. À ce jour, aucun récépissé ne lui a été délivré et sa demande n'a reçu aucune réponse.`,
    );
  else
    lignes.push(
      `Par une décision du ${fr(d.dateDecision)}, notifiée le ${fr(d.dateNotification)}, le ${prefet(d.prefecture)} a ${objetDecision(d)}.`,
    );
  if (r.precisions) lignes.push(r.precisions);
  if (!blocage) lignes.push("C'est la décision attaquée.");
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

function bordereau(d: DonneesActe, premiere: string | null = "Décision attaquée") {
  const liste = [...(premiere ? [premiere] : []), ...d.pieces.filter((p) => !/d[ée]cision (attaqu|contest)/i.test(p))];
  return `BORDEREAU DES PIÈCES\n${liste.map((p, i) => `Pièce n° ${i + 1} : ${p}`).join("\n")}`;
}

/** Accorde le texte au genre de la personne (« né(e) », « il/elle », « l'intéressé(e) »…) quand la civilité est connue. */
export function accorder(texte: string, civilite?: string | null): string {
  if (civilite !== "MADAME" && civilite !== "MONSIEUR") return texte;
  const f = civilite === "MADAME";
  return texte
    .replace(/\bIl\/elle\b/g, f ? "Elle" : "Il")
    .replace(/\bil\/elle\b/g, f ? "elle" : "il")
    .replace(/\b([A-Za-zÀ-ÿ]+)\(ne\)/g, (_, m: string) => (f ? `${m}ne` : m))
    .replace(/\b([A-Za-zÀ-ÿ]+)\(e\)/g, (_, m: string) => (f ? `${m}e` : m));
}


// ---------- Actes contentieux : présentation commune du cabinet ----------
// Toutes les requêtes suivent la même présentation : « À / POUR / CONTRE », pièce n° 1, formule d'ouverture
// (« À l'honneur de vous exposer » au fond, « Plaise au juge des référés » en référé), I. Rappel des faits appuyé sur les pièces,
// II. Discussion où chaque moyen est rédigé en deux temps (« En droit », « En l'espèce »), conclusions homogènes,
// signature et bordereau. Montants et délais par défaut : ceux des modèles du cabinet (1 500 €, 100 € par jour, un mois).

type Juge = "TRIBUNAL" | "REFERES" | "COUR";

function nomCourt(d: DonneesActe) {
  return `${d.civilite === "MADAME" ? "Madame" : d.civilite === "MONSIEUR" ? "Monsieur" : MANQUANT} ${(d.nom ?? MANQUANT).toUpperCase()}`;
}

function enTeteActe(
  d: DonneesActe,
  o: { juge: Juge; titre: string; texte: string; contre: string; piece1?: string; ville?: string; avant?: string },
) {
  const ville = o.ville ?? tribunalCompetent(d.prefecture);
  const a =
    o.juge === "REFERES"
      ? `À : Madame, Monsieur le juge des référés du tribunal administratif de ${ville}.`
      : o.juge === "COUR"
        ? `À : Monsieur le Président, Mesdames et Messieurs les Conseillers composant la cour administrative d'appel de ${ville}.`
        : `À : Monsieur le Président, Mesdames et Messieurs les Conseillers composant le tribunal administratif de ${ville}.`;
  return `${a}
${o.avant ? `\n${o.avant}\n` : ""}
${o.titre}
(${o.texte})

POUR : ${identite(d)}, né(e) le ${fr(d.dateNaissance)} à ${MANQUANT}, de nationalité ${v(d.nationalite)}, domicilié(e) ${v(d.adresse)}.

Ayant pour avocat : ${avocatConstitue(d)}

CONTRE : ${o.contre}.
${o.piece1 ? `\nPièce n° 1 : ${o.piece1}\n` : ""}
${o.juge === "REFERES" ? "Plaise au juge des référés" : "À l'honneur de vous exposer"}`;
}

/** Un moyen : intitulé, puis « En droit » et « En l'espèce ». */
function moyen(numero: string, titre: string, droit: string | null, espece: string) {
  return `${numero}. ${titre}\n\n${droit ? `En droit,\n${droit}\n\nEn l'espèce,\n` : ""}${espece}`;
}

function conclusionsActe(o: { devant: string; principal: string[]; subsidiaire?: string[]; astreinte?: string; frais: string; persistant?: boolean }) {
  const liste = (l: string[]) => l.map((x) => `— ${x} ;`).join("\n");
  const corps = o.subsidiaire?.length
    ? `À titre principal :\n${liste(o.principal)}\n\nÀ titre subsidiaire :\n${liste(o.subsidiaire)}`
    : liste(o.principal);
  return `PAR CES MOTIFS

${o.persistant ? "Persistant dans ses précédentes conclusions, et" : "Et"} tous autres à produire, déduire ou suppléer, au besoin d'office, il est demandé ${o.devant} de :

${corps}
${o.astreinte ? `\n${o.astreinte}\n` : ""}
En tout état de cause :
— ${o.frais}.`;
}

const frais = (d: DonneesActe) => `Condamner l'État à verser à ${nomCourt(d)} la somme de 1 500 euros au titre de l'article L. 761-1 du code de justice administrative`;

function presenceDixAns(d: DonneesActe): boolean {
  const entree = d.reponses.entree;
  if (!entree || !/^\d{4}-\d{2}-\d{2}/.test(entree)) return false;
  const ref = d.dateDecision && /^\d{4}-\d{2}-\d{2}/.test(d.dateDecision) ? new Date(d.dateDecision) : new Date();
  return (ref.getTime() - new Date(entree).getTime()) / (365.25 * 86_400_000) >= 10;
}

const aEnfants = (d: DonneesActe) => !!d.reponses.enfants && d.reponses.enfants !== "0";
const avecRefus = (d: DonneesActe) => d.procedure !== "OQTF" || d.reponses.titreAnt === "oui" || !!d.reponses.demande;

/** Objet de la décision attaquée, tel qu'il figure après « CONTRE : La décision du … ». */
function objetAttaque(d: DonneesActe, oqtf: boolean) {
  if (oqtf)
    return `${avecRefus(d) ? "portant refus de titre de séjour, " : ""}assortie d'une obligation de quitter le territoire français${d.situationOQTF === "LIBRE" ? " dans un délai de trente jours" : ""} et fixant le pays de renvoi`;
  if (d.procedure === "REFUS_IMPLICITE") return `née du silence gardé sur la demande de titre de séjour présentée le ${fr(d.reponses.demande)}`;
  return `portant refus de ${d.reponses.titreAnt === "oui" ? "renouvellement d'un" : "délivrance d'un"} titre de séjour`;
}

const decisionAttaquee = (d: DonneesActe, oqtf: boolean) => `La décision du ${fr(d.dateDecision)} ${objetAttaque(d, oqtf)}, prise par ${prefet(d.prefecture, true).replace(/^P/, "Monsieur le P")}`;

function rappelFaits(d: DonneesActe, cloture: string) {
  // La décision attaquée renvoie à la pièce n° 1, comme dans les actes du cabinet.
  const recit = faits(d).replace(/\.\nC'est la décision attaquée\.$/, " (Pièce n° 1).");
  return `I. RAPPEL DES FAITS

${recit}

${cloture}`;
}

const EXTERNE_COMPETENCE = (d: DonneesActe) =>
  moyen(
    "a",
    "Sur l'incompétence de l'auteur de la décision",
    "Les règles de compétence sont d'ordre public et le juge les examine au besoin d'office. L'administration doit justifier que le signataire de la décision bénéficiait d'une délégation de signature régulière, visant ce type de décision et publiée avant son édiction : une délégation n'est opposable qu'après sa publication au recueil des actes administratifs de la préfecture (CE, 28 février 1996, Préfet des Yvelines c/ Oluc, n° 150991).",
    `La décision attaquée n'a pas été signée par le ${prefet(d.prefecture)} lui-même mais par ${MANQUANT}, qui ne justifie pas d'une délégation de signature régulière, spéciale et publiée. À défaut d'une telle justification, la décision encourt l'annulation.`,
  );

const EXTERNE_MOTIVATION = (d: DonneesActe) =>
  moyen(
    "b",
    "Sur l'insuffisance de motivation et le défaut d'examen complet et sérieux de la situation",
    "En vertu des articles L. 211-2 et L. 211-5 du code des relations entre le public et l'administration, les décisions individuelles défavorables doivent être motivées et comporter l'énoncé des considérations de droit et de fait qui en constituent le fondement. Une décision qui se borne à viser un texte sans expliciter les considérations retenues n'est pas suffisamment motivée (CE, 10 décembre 2003, Préfet du Bas-Rhin, n° 250138). L'autorité administrative doit en outre procéder à un examen réel et individualisé de la situation de l'intéressé(e) ; l'absence d'examen particulier, révélée par un raisonnement stéréotypé, entraîne l'annulation (CAA Paris, 5 septembre 2022, n° 22PA01751).",
    `${MANQUANT}. Le ${prefet(d.prefecture)} n'a pas procédé à un examen particulier de la situation de ${nomCourt(d)}, notamment ${MANQUANT}.`,
  );

const EXTERNE_COMMISSION = (d: DonneesActe) =>
  moyen(
    "c",
    "Sur le défaut de saisine de la commission du titre de séjour",
    "Aux termes de l'article L. 435-1 du code de l'entrée et du séjour des étrangers et du droit d'asile, lorsqu'elle envisage de refuser la demande d'admission exceptionnelle au séjour formée par un étranger qui justifie par tout moyen résider habituellement en France depuis plus de dix ans, l'autorité administrative est tenue de soumettre cette demande pour avis à la commission du titre de séjour. L'article L. 432-13 du même code prévoit la saisine de cette commission dans ce cas.",
    `${nomCourt(d)} réside habituellement en France depuis le ${fr(d.reponses.entree)}, soit depuis plus de dix ans. Le ${prefet(d.prefecture)} devait saisir la commission du titre de séjour avant de prendre sa décision ; il ne l'a pas fait : ${MANQUANT}. La décision est entachée d'un vice de procédure qui justifie son annulation.`,
  );

const ART8 =
  "Aux termes de l'article 8 de la convention européenne de sauvegarde des droits de l'homme et des libertés fondamentales : « 1. Toute personne a droit au respect de sa vie privée et familiale, de son domicile et de sa correspondance. 2. Il ne peut y avoir ingérence d'une autorité publique dans l'exercice de ce droit que pour autant que cette ingérence est prévue par la loi et qu'elle constitue une mesure qui, dans une société démocratique, est nécessaire à la sécurité nationale, à la sûreté publique, au bien-être économique du pays, à la défense de l'ordre et à la prévention des infractions pénales, à la protection de la santé ou de la morale, ou à la protection des droits et libertés d'autrui. »";

const CIDE =
  "Aux termes de l'article 3-1 de la convention internationale des droits de l'enfant : « Dans toutes les décisions qui concernent les enfants, qu'elles soient le fait des institutions publiques ou privées de protection sociale, des tribunaux, des autorités administratives ou des organes législatifs, l'intérêt supérieur de l'enfant doit être une considération primordiale. »";

/** Moyens contre le refus de séjour (A. légalité externe, B. légalité interne). */
function moyensRefus(d: DonneesActe) {
  const internes = [
    ["Sur l'erreur de fait", "Une décision administrative est illégale lorsqu'elle repose sur des faits matériellement inexacts ; le juge de l'excès de pouvoir contrôle l'exactitude matérielle des faits qui en constituent le fondement.", `${MANQUANT}.`],
    ["Sur l'erreur de droit et l'erreur manifeste d'appréciation", `${MANQUANT} : texte sur lequel le préfet a fondé son refus et conditions du titre sollicité (${v(d.reponses.fondement)}).`, `${MANQUANT}.`],
    [
      "Sur la violation de l'article 8 de la convention européenne des droits de l'homme",
      ART8,
      `${nomCourt(d)} réside en France depuis le ${fr(d.reponses.entree)} et y a fixé le centre de ses intérêts privés et familiaux : ${MANQUANT}. La décision porte à son droit au respect de sa vie privée et familiale une atteinte disproportionnée aux buts en vue desquels elle a été prise.`,
    ],
  ];
  if (aEnfants(d)) internes.push(["Sur la méconnaissance de l'intérêt supérieur de l'enfant", CIDE, `${MANQUANT}.`]);
  if (d.algerien)
    internes.push([
      "Sur la méconnaissance de l'accord franco-algérien du 27 décembre 1968",
      `Ressortissant(e) algérien(ne), ${nomCourt(d)} relève des stipulations de l'accord franco-algérien, notamment de son article ${MANQUANT}.`,
      `${MANQUANT}.`,
    ]);
  const lettres = "abcdefg";
  return `A. Sur l'illégalité externe de la décision

${[EXTERNE_COMPETENCE(d), EXTERNE_MOTIVATION(d), ...(presenceDixAns(d) ? [EXTERNE_COMMISSION(d)] : [])].join("\n\n")}

B. Sur l'illégalité interne de la décision

${internes.map(([t, droit, esp], i) => moyen(lettres[i], t, droit, esp)).join("\n\n")}`;
}

/** Moyens contre l'obligation de quitter le territoire. */
function moyensOqtf(d: DonneesActe, refus: boolean) {
  const l: string[] = [];
  if (refus)
    l.push(
      moyen(
        "a",
        "Sur l'exception d'illégalité de la décision portant refus de séjour",
        null,
        "La décision portant refus de séjour étant entachée d'illégalité, la décision portant obligation de quitter le territoire français, qui en constitue la mesure subséquente et en est indissociable, est privée de base légale et doit, par voie de conséquence, être annulée.",
      ),
    );
  else l.push(EXTERNE_COMPETENCE(d), EXTERNE_MOTIVATION(d));
  const n = () => "abcdefg"[l.length];
  l.push(moyen(n(), "Sur la méconnaissance de l'article L. 611-3 du code de l'entrée et du séjour des étrangers et du droit d'asile", "L'article L. 611-3 du code de l'entrée et du séjour des étrangers et du droit d'asile énumère les étrangers qui ne peuvent faire l'objet d'une décision portant obligation de quitter le territoire français.", `${MANQUANT} : vérifier si l'intéressé(e) relève d'une catégorie protégée contre l'éloignement.`));
  l.push(
    moyen(
      n(),
      "Sur la violation de l'article 8 de la convention européenne des droits de l'homme",
      refus ? null : ART8,
      `L'obligation faite à ${nomCourt(d)} de quitter le territoire français porte une atteinte manifestement disproportionnée à son droit au respect de sa vie privée et familiale.\nEn premier lieu, ${MANQUANT}.\nEn deuxième lieu, ${MANQUANT}.\nEn dernier lieu, ${MANQUANT}.`,
    ),
  );
  if (aEnfants(d)) l.push(moyen(n(), "Sur la méconnaissance de l'intérêt supérieur de l'enfant", refus ? null : CIDE, `${MANQUANT}.`));
  return l.join("\n\n");
}

/** Discussion d'une requête en annulation (ou d'un mémoire complémentaire). */
function discussionAnnulation(d: DonneesActe, oqtf: boolean) {
  const refus = avecRefus(d);
  if (!oqtf) return moyensRefus(d);
  const parties: string[] = [];
  let i = 1;
  if (refus) parties.push(`${i++}. Sur la décision portant refus de titre de séjour\n\n${moyensRefus(d)}`);
  parties.push(`${i++}. Sur la décision portant obligation de quitter le territoire français\n\n${moyensOqtf(d, refus)}`);
  parties.push(
    `${i++}. Sur la décision fixant le pays de renvoi\n\n${moyen("a", "Sur l'exception d'illégalité", null, "La décision fixant le pays de renvoi est privée de base légale du fait de l'illégalité de l'obligation de quitter le territoire français.")}\n\n${moyen("b", "Sur la méconnaissance de l'article 3 de la convention européenne des droits de l'homme", "Aux termes de l'article 3 de la convention européenne de sauvegarde des droits de l'homme et des libertés fondamentales : « Nul ne peut être soumis à la torture ni à des peines ou traitements inhumains ou dégradants. »", `${MANQUANT}.`)}`,
  );
  return parties.join("\n\n");
}

function conclusionsAnnulationCabinet(d: DonneesActe, oqtf: boolean, persistant = false) {
  const lePrefet = prefet(d.prefecture);
  return conclusionsActe({
    devant: "au Tribunal",
    persistant,
    principal: [
      `Annuler la décision du ${fr(d.dateDecision)} du ${lePrefet} ${objetAttaque(d, oqtf)}`,
      `Enjoindre au ${lePrefet} de délivrer à ${nomCourt(d)} un titre de séjour portant la mention « ${MANQUANT} » dans un délai d'un mois à compter de la notification du jugement`,
    ],
    subsidiaire: [`Enjoindre au ${lePrefet} de réexaminer sa situation dans un délai d'un mois à compter de la notification du jugement, en lui délivrant dans cette attente une autorisation provisoire de séjour`],
    astreinte: "le tout sous astreinte de 100 euros par jour de retard ;",
    frais: frais(d),
  });
}

function requeteAnnulation(d: DonneesActe, oqtf: boolean): string {
  const nom = nomCourt(d);
  return `${enTeteActe(d, {
    juge: "TRIBUNAL",
    titre: "REQUÊTE EN ANNULATION",
    texte: oqtf ? "articles L. 614-1 et suivants du code de l'entrée et du séjour des étrangers et du droit d'asile" : "article R. 421-1 du code de justice administrative",
    contre: decisionAttaquee(d, oqtf),
    piece1: "Décision attaquée",
  })}

${rappelFaits(d, `${nom} entend contester cette décision, entachée d'illégalité tant externe qu'interne.\n\nC'est dans cet état que se présente cette affaire.`)}

II. DISCUSSION

${nom} soulève des moyens d'illégalité tant externe qu'interne entachant la légalité de la décision litigieuse.

${discussionAnnulation(d, oqtf)}

${conclusionsAnnulationCabinet(d, oqtf)}

${signature(d)}

${bordereau(d)}`;
}

function requeteSommaire(d: DonneesActe): string {
  const oqtf = d.procedure === "OQTF";
  const nom = nomCourt(d);
  return `${enTeteActe(d, {
    juge: "TRIBUNAL",
    titre: "REQUÊTE SOMMAIRE",
    texte: "un mémoire complémentaire sera produit dans un délai de quinze jours",
    contre: decisionAttaquee(d, oqtf),
    piece1: "Décision attaquée",
  })}

${rappelFaits(d, "C'est dans cet état que se présente cette affaire.")}

II. DISCUSSION

${nom} soulève des moyens d'illégalité tant externe qu'interne entachant la légalité de la décision litigieuse.

A. Sur l'illégalité externe de la décision
La décision est entachée d'incompétence de son auteur, d'une insuffisance de motivation et d'un défaut d'examen particulier de la situation de ${nom}.

B. Sur l'illégalité interne de la décision
La décision méconnaît l'article 8 de la convention européenne des droits de l'homme${aEnfants(d) ? " et l'article 3-1 de la convention internationale des droits de l'enfant" : ""} et est entachée d'une erreur manifeste d'appréciation.

Ces moyens seront développés dans un mémoire complémentaire.

${conclusionsAnnulationCabinet(d, oqtf)}

${signature(d)}

${bordereau(d)}`;
}

function memoireComplementaire(d: DonneesActe): string {
  const oqtf = d.procedure === "OQTF";
  const nom = nomCourt(d);
  return `${enTeteActe(d, {
    juge: "TRIBUNAL",
    titre: "MÉMOIRE COMPLÉMENTAIRE",
    texte: `requête n° ${MANQUANT} enregistrée le ${MANQUANT}`,
    contre: decisionAttaquee(d, oqtf),
  })}

En complément de sa requête, ${nom} développe les moyens suivants.

DISCUSSION

${discussionAnnulation(d, oqtf)}

${conclusionsAnnulationCabinet(d, oqtf, true)}

${signature(d)}`;
}

function refereSuspension(d: DonneesActe): string {
  const nom = nomCourt(d);
  const lePrefet = prefet(d.prefecture);
  return `${enTeteActe(d, {
    juge: "REFERES",
    titre: "REQUÊTE EN RÉFÉRÉ-SUSPENSION",
    texte: "article L. 521-1 du code de justice administrative",
    contre: decisionAttaquee(d, false),
    piece1: "Décision attaquée",
  })}

${rappelFaits(d, `Par une requête enregistrée le ${MANQUANT} sous le numéro ${MANQUANT}, ${nom} a demandé l'annulation de cette décision.\nPièce n° 2 : Requête en annulation\n\nC'est dans ce contexte que ${nom} saisit le juge des référés.`)}

II. DISCUSSION

Aux termes de l'article L. 521-1 du code de justice administrative : « Quand une décision administrative, même de rejet, fait l'objet d'une requête en annulation ou en réformation, le juge des référés, saisi d'une demande en ce sens, peut ordonner la suspension de l'exécution de cette décision, ou de certains de ses effets, lorsque l'urgence le justifie et qu'il est fait état d'un moyen propre à créer, en l'état de l'instruction, un doute sérieux quant à la légalité de la décision. »

${moyen("A", "Sur l'urgence", "L'urgence justifie la suspension lorsque l'exécution de la décision porte atteinte, de manière suffisamment grave et immédiate, à la situation du requérant ou aux intérêts qu'il entend défendre. Elle est en principe présumée lorsque la décision refuse le renouvellement d'un titre de séjour.", `La décision prive ${nom} de ${MANQUANT} (droit au séjour, emploi, ressources). ${MANQUANT}. La condition d'urgence est, par conséquent, remplie.`)}

${moyen("B", "Sur le doute sérieux quant à la légalité de la décision", null, `Les moyens développés dans la requête au fond sont de nature à créer, en l'état de l'instruction, un doute sérieux quant à la légalité de la décision :\n— ${MANQUANT} ;\n— ${MANQUANT}.`)}

${conclusionsActe({
  devant: "au juge des référés",
  principal: [
    `Suspendre l'exécution de la décision du ${fr(d.dateDecision)} du ${lePrefet} ${objetAttaque(d, false)}`,
    `Enjoindre au ${lePrefet} de réexaminer la situation de ${nom} dans un délai d'un mois à compter de l'ordonnance à intervenir, en lui délivrant dans cette attente une autorisation provisoire de séjour l'autorisant à travailler`,
  ],
  astreinte: "le tout sous astreinte de 100 euros par jour de retard ;",
  frais: frais(d),
})}

${signature(d)}

${bordereau({ ...d, pieces: ["Requête en annulation", ...d.pieces] })}`;
}

function refereLiberte(d: DonneesActe): string {
  const nom = nomCourt(d);
  const lePrefet = prefet(d.prefecture);
  return `${enTeteActe(d, {
    juge: "REFERES",
    titre: "REQUÊTE EN RÉFÉRÉ-LIBERTÉ",
    texte: "article L. 521-2 du code de justice administrative",
    contre: `Le refus implicite du ${lePrefet} de délivrer à ${nom} un récépissé de sa demande de titre de séjour présentée le ${fr(d.reponses.demande)}`,
  })}

${rappelFaits(d, `C'est dans ce contexte et compte tenu du risque imminent de la perte de son emploi que ${nom} saisit votre juridiction.`)}

II. DISCUSSION

Aux termes de l'article L. 521-2 du code de justice administrative : « Saisi d'une demande en ce sens justifiée par l'urgence, le juge des référés peut ordonner toutes mesures nécessaires à la sauvegarde d'une liberté fondamentale à laquelle une personne morale de droit public ou un organisme de droit privé chargé de la gestion d'un service public aurait porté, dans l'exercice d'un de ses pouvoirs, une atteinte grave et manifestement illégale. Le juge des référés se prononce dans un délai de quarante-huit heures. »

${nom} établira qu'il/elle remplit les conditions prévues par ce texte.

${moyen(
  "A",
  "Sur l'urgence",
  "Le juge des référés retient l'urgence lorsque l'absence de récépissé autorisant à travailler empêche l'étranger de poursuivre son emploi et le place dans une situation de grande précarité (TA Cergy-Pontoise, 15 décembre 2020, n° 2012605), ou fait peser un risque immédiat sur la poursuite de sa relation de travail, son employeur l'ayant mis en demeure de justifier de la régularité de son séjour (TA Marseille, 3 février 2023, n° 2301049).",
  `${nom} a sollicité ${d.reponses.titreAnt === "oui" ? "le renouvellement de son titre de séjour" : "la délivrance d'un titre de séjour"} le ${fr(d.reponses.demande)}. Aucun récépissé ne lui a été délivré. ${MANQUANT} : expiration du titre, emploi occupé, mise en demeure de l'employeur. Cette situation rend indispensable l'intervention à très bref délai du juge des référés. La condition d'urgence est, par conséquent, remplie.`,
)}

B. Sur l'atteinte grave et manifestement illégale à une liberté fondamentale

${moyen(
  "1",
  "Sur l'atteinte à la liberté d'aller et venir et au droit d'exercer une activité professionnelle",
  "La liberté d'aller et venir, composante de la liberté personnelle protégée par les articles 2 et 4 de la Déclaration des droits de l'homme et du citoyen, constitue une liberté fondamentale au sens de l'article L. 521-2 du code de justice administrative (CE, 11 avril 2018, n° 418027). Elle a valeur constitutionnelle (Cons. const., 12 juillet 1979, n° 79-107 DC) et est garantie par l'article 2 du protocole n° 4 à la convention européenne des droits de l'homme.",
  `Dépourvu(e) de tout document attestant la régularité de son séjour du fait de l'inertie de la préfecture, ${nom} ne peut plus se déplacer librement ni exécuter son contrat de travail : ${MANQUANT}. En procédant ainsi, le ${lePrefet} porte une atteinte grave et manifestement illégale à sa liberté d'aller et venir et à son droit d'exercer une activité professionnelle.`,
)}

${moyen(
  "2",
  "Sur la méconnaissance de l'article R. 431-12 du code de l'entrée et du séjour des étrangers et du droit d'asile",
  "Aux termes de l'article R. 431-12 du code de l'entrée et du séjour des étrangers et du droit d'asile : « L'étranger admis à souscrire une demande de délivrance ou de renouvellement de titre de séjour se voit remettre un récépissé qui autorise la présence de l'intéressé sur le territoire pour la durée qu'il précise. »",
  `La demande de ${nom} a été reçue par la préfecture le ${MANQUANT}. Le ${lePrefet} devait lui remettre un récépissé. À ce jour, soit plus de ${MANQUANT} après, aucun document justifiant la régularité de son séjour ne lui a été délivré. Le silence de la préfecture méconnaît ainsi les dispositions précitées.`,
)}

${conclusionsActe({
  devant: "au juge des référés",
  principal: [
    `Enjoindre au ${lePrefet} de délivrer à ${nom} un récépissé de demande de titre de séjour l'autorisant à travailler dans un délai de 48 heures à compter de l'ordonnance à intervenir`,
    `Enjoindre au ${lePrefet} de statuer sur sa demande de titre de séjour dans un délai de quinze jours à compter de l'ordonnance à intervenir`,
    "Assortir ces injonctions d'une astreinte de 100 euros par jour de retard, en application des articles L. 911-1 et L. 911-3 du code de justice administrative",
  ],
  frais: frais(d),
})}

${signature(d)}

${bordereau(d, null)}`;
}

function refereMesuresUtiles(d: DonneesActe): string {
  const nom = nomCourt(d);
  const lePrefet = prefet(d.prefecture);
  return `${enTeteActe(d, {
    juge: "REFERES",
    titre: "REQUÊTE EN RÉFÉRÉ « MESURES UTILES »",
    texte: "article L. 521-3 du code de justice administrative",
    contre: `La carence du ${lePrefet} à ${MANQUANT} (fixer un rendez-vous, enregistrer la demande, délivrer un récépissé)`,
  })}

${rappelFaits(d, `${nom} a sollicité ${MANQUANT} auprès de la préfecture le ${fr(d.reponses.demande)}. Malgré ses démarches (${MANQUANT} : demandes de rendez-vous, mise en demeure du ${MANQUANT}), aucune suite n'a été donnée.\n\nC'est dans ce contexte que ${nom} saisit le juge des référés.`)}

II. DISCUSSION

Aux termes de l'article L. 521-3 du code de justice administrative : « En cas d'urgence et sur simple requête qui sera recevable même en l'absence de décision administrative préalable, le juge des référés peut ordonner toutes autres mesures utiles sans faire obstacle à l'exécution d'aucune décision administrative. »

${moyen("A", "Sur l'urgence", null, `${MANQUANT}. La condition d'urgence est, par conséquent, remplie.`)}

${moyen("B", "Sur l'utilité de la mesure", null, `${MANQUANT}.`)}

${moyen("C", "Sur l'absence de contestation sérieuse et d'obstacle à l'exécution d'une décision administrative", null, `La mesure demandée ne se heurte à aucune contestation sérieuse et ne fait obstacle à l'exécution d'aucune décision administrative : ${MANQUANT}.`)}

${conclusionsActe({
  devant: "au juge des référés",
  principal: [`Enjoindre au ${lePrefet} de ${MANQUANT} dans un délai de quinze jours à compter de l'ordonnance à intervenir`],
  astreinte: "le tout sous astreinte de 100 euros par jour de retard ;",
  frais: frais(d),
})}

${signature(d)}

${bordereau(d, null)}`;
}

function requeteAppel(d: DonneesActe): string {
  const a = d.appel;
  const tribunal = a?.tribunal && a.tribunal !== MANQUANT ? a.tribunal : MANQUANT;
  const nom = nomCourt(d);
  const lePrefet = prefet(d.prefecture);
  return `${enTeteActe(d, {
    juge: "COUR",
    ville: courAppel(tribunal),
    titre: "REQUÊTE D'APPEL",
    texte: "articles R. 811-1 et suivants du code de justice administrative",
    contre: `Le jugement n° ${v(a?.numero)} du tribunal administratif de ${tribunal} du ${fr(d.dateDecision)}, notifié le ${fr(d.dateNotification)}`,
    piece1: "Jugement attaqué",
  })}

I. RAPPEL DES FAITS ET DE LA PROCÉDURE

Par une décision du ${MANQUANT}, le ${lePrefet} a ${objetDecision({ ...d, reponses: d.reponses ?? {} })}.
Par une requête enregistrée le ${MANQUANT}, ${nom} en a demandé l'annulation au tribunal administratif de ${tribunal}.
Par le jugement attaqué, le tribunal a rejeté sa demande au motif que ${MANQUANT}.

C'est le jugement dont il est relevé appel.

II. DISCUSSION

${moyen("A", "Sur la régularité du jugement", null, `${MANQUANT} (omission à statuer, insuffisance de motivation, méconnaissance du contradictoire).`)}

${moyen("B", "Sur le bien-fondé du jugement", null, `C'est à tort que le tribunal a jugé que ${MANQUANT}.\nPar l'effet dévolutif de l'appel, ${nom} reprend les moyens soulevés en première instance : ${MANQUANT}.`)}

${conclusionsActe({
  devant: "à la Cour",
  principal: [
    `Annuler le jugement n° ${v(a?.numero)} du tribunal administratif de ${tribunal} du ${fr(d.dateDecision)}`,
    `Annuler la décision du ${lePrefet} du ${MANQUANT}`,
    `Enjoindre au ${lePrefet} de délivrer à ${nom} un titre de séjour portant la mention « ${MANQUANT} » dans un délai d'un mois à compter de la notification de l'arrêt`,
  ],
  subsidiaire: [`Enjoindre au ${lePrefet} de réexaminer sa situation dans un délai d'un mois à compter de la notification de l'arrêt, en lui délivrant dans cette attente une autorisation provisoire de séjour`],
  astreinte: "le tout sous astreinte de 100 euros par jour de retard ;",
  frais: frais(d),
})}

${signature(d)}

${bordereau({ ...d, pieces: ["Jugement attaqué", ...d.pieces] })}`;
}


export function genererModele(code: CodeModele, d: DonneesActe): string {
  return accorder(genererModeleBrut(code, d), d.civilite);
}

function genererModeleBrut(code: CodeModele, d: DonneesActe): string {
  switch (code) {
    case "REQUETE_OQTF":
      return requeteAnnulation(d, true);

    case "REQUETE_REFUS_TITRE":
      return requeteAnnulation(d, false);

    case "REQUETE_SOMMAIRE":
      return requeteSommaire(d);

    case "MEMOIRE_COMPLEMENTAIRE":
      return memoireComplementaire(d);

    case "REFERE_SUSPENSION":
      return refereSuspension(d);

    case "REFERE_LIBERTE":
      return refereLiberte(d);

    case "REFERE_MESURES_UTILES":
      return refereMesuresUtiles(d);

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

Objet : recours administratif préalable obligatoire contre le refus de visa ${d.reponses.consulat ? `opposé par ${consulat(d.reponses.consulat)}` : MANQUANT} du ${fr(d.dateDecision)}
Demandeur : ${identite(d)}
Réf. : ${d.reference}

Madame, Monsieur les membres de la commission,

En ma qualité de conseil de ${identite(d)}, j'ai l'honneur de former un recours contre la décision du ${fr(d.dateDecision)} par laquelle ${consulat(d.reponses.consulat)} ont refusé de lui délivrer un visa ${v(d.reponses.motif)}.

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

    case "REQUETE_APPEL":
      return requeteAppel(d);

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

// ---------- Modèles du cabinet (déposés au back office) ----------
// Un modèle du cabinet remplace le modèle intégré pour son type d'acte. Il contient des variables entre doubles accolades,
// remplacées par les données du dossier ; une donnée absente ou une variable inconnue devient XXX.

export interface VariableModele {
  nom: string;
  libelle: string;
  valeur: (d: DonneesActe) => string;
}

export const VARIABLES: VariableModele[] = [
  { nom: "client", libelle: "Civilité, prénom et NOM du client", valeur: identite },
  { nom: "civilite", libelle: "Madame ou Monsieur", valeur: (d) => (d.civilite === "MADAME" ? "Madame" : d.civilite === "MONSIEUR" ? "Monsieur" : MANQUANT) },
  { nom: "prenom", libelle: "Prénom du client", valeur: (d) => v(d.prenom) },
  { nom: "nom", libelle: "NOM du client", valeur: (d) => v(d.nom?.toUpperCase()) },
  { nom: "date_naissance", libelle: "Date de naissance", valeur: (d) => fr(d.dateNaissance) },
  { nom: "nationalite", libelle: "Nationalité", valeur: (d) => v(d.nationalite) },
  { nom: "adresse", libelle: "Adresse postale du client", valeur: (d) => v(d.adresse) },
  { nom: "prefecture", libelle: "Préfecture (telle que saisie)", valeur: (d) => v(d.prefecture) },
  { nom: "prefet", libelle: "« préfet de … » (dans une phrase)", valeur: (d) => prefet(d.prefecture) },
  { nom: "Prefet", libelle: "« Préfet de … » (en début de ligne)", valeur: (d) => prefet(d.prefecture, true) },
  { nom: "tribunal", libelle: "Ville du tribunal administratif compétent", valeur: (d) => tribunalCompetent(d.prefecture) },
  { nom: "TRIBUNAL", libelle: "Ville du tribunal, en capitales", valeur: (d) => tribunalCompetent(d.prefecture).toUpperCase() },
  { nom: "cour", libelle: "Ville de la cour administrative d'appel", valeur: (d) => courAppel(d.appel?.tribunal ?? tribunalCompetent(d.prefecture)) },
  { nom: "date_decision", libelle: "Date de la décision (ou du jugement en appel)", valeur: (d) => fr(d.dateDecision) },
  { nom: "date_notification", libelle: "Date de notification", valeur: (d) => fr(d.dateNotification) },
  { nom: "date_limite", libelle: "Date limite du recours", valeur: (d) => fr(d.dateLimite) },
  { nom: "numero_jugement", libelle: "N° du jugement attaqué (appel)", valeur: (d) => v(d.appel?.numero) },
  { nom: "objet_decision", libelle: "Ce qu'a décidé le préfet (phrase)", valeur: (d) => objetDecision(d) },
  { nom: "faits", libelle: "Exposé des faits rédigé à partir du questionnaire", valeur: faits },
  { nom: "question", libelle: "Question posée par le client (avis)", valeur: (d) => v(d.question) },
  { nom: "reference", libelle: "Référence du dossier", valeur: (d) => d.reference },
  { nom: "avocat", libelle: "Maître Prénom Nom", valeur: (d) => (d.avocat ? `Maître ${d.avocat.prenom} ${d.avocat.nom}` : `Maître ${MANQUANT}`) },
  { nom: "avocat_constitue", libelle: "Avocat constitué avec la SELARL et l'adresse du cabinet", valeur: avocatConstitue },
  { nom: "signature", libelle: "« Fait à Paris, le … » et signature", valeur: signature },
  { nom: "bordereau", libelle: "Bordereau des pièces numérotées", valeur: bordereau },
];

/** Remplit un modèle du cabinet : {{variable}} → donnée du dossier, sinon XXX. */
export function remplirModele(texte: string, d: DonneesActe): string {
  return accorder(remplirModeleBrut(texte, d), d.civilite);
}

function remplirModeleBrut(texte: string, d: DonneesActe): string {
  const parNom = new Map(VARIABLES.map((x) => [x.nom, x]));
  return texte.replace(/\{\{\s*([A-Za-z_]+)\s*\}\}/g, (_, nom: string) => {
    const x = parNom.get(nom);
    if (!x) return MANQUANT;
    const r = x.valeur(d);
    return r && r.trim() ? r : MANQUANT;
  });
}

/** Variables inconnues d'un modèle (signalées à l'enregistrement). */
export function variablesInconnues(texte: string): string[] {
  const connues = new Set(VARIABLES.map((x) => x.nom));
  return [...new Set([...texte.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((m) => m[1]).filter((n) => !connues.has(n)))];
}

/** Données fictives pour l'aperçu d'un modèle au back office. */
export const DONNEES_EXEMPLE: DonneesActe = {
  civilite: "MADAME",
  prenom: "Nadia",
  nom: "Exemple",
  procedure: "REFUS_TITRE",
  prefecture: "Préfecture du Val-de-Marne",
  dateDecision: "2026-09-15",
  dateNotification: "2026-09-20",
  dateLimite: "2026-11-20",
  reponses: { entree: "2016-03-01", famille: "marie", enfants: "2", scolarises: "oui", activite: "cdi", anciennete: "3 ans" },
  question: "Puis-je demander un changement de statut ?",
  avocat: { prenom: "Prénom", nom: "Nom" },
  pieces: ["Décision attaquée", "Passeport", "Contrat de travail"],
  reference: "D0000",
  adresse: "12 rue de la Paix, 94000 Créteil",
  dateNaissance: null,
  nationalite: null,
};

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
