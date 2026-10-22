// Convention d'honoraires en ligne (cahier des charges, section 5.2), structure VARTIS en sept articles.
// Le texte est prérempli pour chaque dossier ; le texte exact accepté est archivé avec son empreinte.
// Les articles seront modifiables au back office (lot 5) ; les versions acceptées restent consultables à l'identique.
// Les informations manquantes sont marquées XXX : la vue d'ensemble du back office les signale avant la mise en ligne.

import { MENTION_TVA_HORS_UE } from "./pays";
import { formatEuros, type Diligence } from "./procedures";

export const VERSION_CONVENTION = "2026-10-22.1";

export interface LigneHonoraires {
  diligence: Diligence;
  libelle: string;
  montant: number; // centimes TTC
}

export interface DonneesConvention {
  civilite?: "MADAME" | "MONSIEUR";
  prenom?: string;
  nom?: string;
  adresse?: string; // adresse postale sur une ligne
  reference: string;
  procedureLibelle: string;
  recoursPrealable: boolean; // visa, naturalisation : mission jusqu'à la réponse de l'administration
  lignes: LigneHonoraires[];
  troisFois: boolean;
  dateLimite?: string; // JJ/MM/AAAA
  /** Client résidant hors de l'Union européenne : même prix, sans TVA (article 259 B du CGI). */
  horsUE?: boolean;
  /** Avenant d'appel : référence du dossier de première instance. */
  appelDe?: string;
}

export const MEDIATEUR =
  "Médiateur de la consommation de la profession d'avocat, 180 boulevard Haussmann, 75008 Paris, https://mediateur-consommation-avocat.fr";

const CABINET =
  "La SELARL VARTIS Avocats, société d'exercice libéral à responsabilité limitée d'avocats au barreau de Paris, " +
  "immatriculée sous le numéro 937 773 885, dont le siège est 222 boulevard Saint-Germain, 75007 Paris, " +
  "exerçant sous la dénomination commerciale LEXPATRIA Avocats, ci-après « le Cabinet »";

export function texteConvention(d: DonneesConvention): string {
  const qui =
    d.prenom || d.nom
      ? `${d.civilite === "MADAME" ? "Madame" : d.civilite === "MONSIEUR" ? "Monsieur" : ""} ${d.prenom ?? ""} ${d.nom ?? ""}`.replace(/\s+/g, " ").trim()
      : "Le client identifié lors du dépôt";
  const total = d.lignes.reduce((s, l) => s + l.montant, 0);
  const ttc = d.horsUE ? "" : " TTC";
  const lignes = d.lignes.map((l) => `- ${l.libelle} : ${formatEuros(l.montant)}${ttc}`).join("\n");
  const mission = d.appelDe
    ? `La mission couvre l'instance d'appel : rédaction et dépôt de la requête d'appel, tous les mémoires utiles et la plaidoirie devant la cour lorsque l'avocat l'estime opportune. Elle complète la convention acceptée pour le dossier de première instance ${d.appelDe}, dont les autres stipulations demeurent.`
    : d.recoursPrealable
    ? "La mission s'achève à la réponse de l'administration ou à la naissance d'une décision implicite de rejet. En cas de rejet, la requête devant le tribunal administratif fait l'objet d'une proposition distincte."
    : "La mission couvre l'ensemble de la première instance : rédaction et dépôt de la requête, tous les mémoires utiles et la plaidoirie à l'audience lorsque l'avocat l'estime opportune.";

  return `${d.appelDe ? "AVENANT D'APPEL À LA CONVENTION D'HONORAIRES" : "CONVENTION D'HONORAIRES"} — DOSSIER ${d.reference}
Version ${VERSION_CONVENTION}

ENTRE
${CABINET},
D'UNE PART,

ET
${qui}${d.adresse ? `, demeurant ${d.adresse}` : ""}, ci-après « le Client »,
D'AUTRE PART.

EXPOSÉ PRÉALABLE
Le Client a été informé que le Cabinet n'intervient pas au titre de l'aide juridictionnelle et qu'il lui appartient de vérifier si un contrat d'assurance de protection juridique peut prendre en charge tout ou partie des honoraires.

ARTICLE 1 — OBJET ET PÉRIMÈTRE
Le Client confie au Cabinet la mission suivante : ${d.procedureLibelle}.
${mission}
Sont exclus de la mission : ${d.appelDe ? "le pourvoi en cassation" : "l'appel"}, les procédures de référé non prévues ci-dessous, l'exécution de la décision et toute procédure devant le juge judiciaire. ${d.appelDe ? "Les référés font" : "L'appel et les référés font"}, le cas échéant, l'objet d'un avenant soumis à l'accord du Client.
Le Cabinet est tenu d'une obligation de moyens. Le Client s'engage à fournir des informations exactes et les pièces demandées dans les meilleurs délais. Avant le dépôt, l'avocat attribué examine le dossier, vérifie la date de notification de la décision et le délai de recours${d.appelDe ? " (ici, la date de notification du jugement et le délai d'appel)" : ""}.

ARTICLE 2 — HONORAIRES
Les honoraires sont fixés forfaitairement comme suit :
${lignes}
Total : ${formatEuros(total)}${d.horsUE ? ` (${MENTION_TVA_HORS_UE})` : " TTC"}.
Ce forfait est ferme. Il ne comporte aucun honoraire de résultat. Hors Île-de-France, seuls les frais de déplacement de l'avocat pour l'audience font l'objet d'un avenant soumis à l'accord préalable du Client.
Si l'avocat constate, à l'examen du dossier, que le délai de recours était déjà expiré au jour du paiement, aucune procédure n'est engagée : les honoraires sont remboursés, sous déduction de 69 € correspondant à l'examen du dossier et à l'avis écrit remis au Client. Une fois la procédure engagée, elle est menée jusqu'au dépôt ; aucun remboursement n'intervient après le dépôt.
Les sommes que la juridiction pourrait mettre à la charge de l'administration au titre de l'article L. 761-1 du code de justice administrative reviennent au Client. Le Cabinet n'en assure pas le recouvrement mais indique au Client la marche à suivre pour les obtenir.

ARTICLE 3 — FRAIS ET MODALITÉS DE RÈGLEMENT
Les frais d'envoi des courriers recommandés sont compris dans le forfait. Les honoraires sont réglés en ligne, par carte bancaire${d.troisFois ? " ou, au choix du Client, en trois fois par l'intermédiaire de Klarna, qui règle le Cabinet en totalité et recouvre seul les échéances auprès du Client" : ""}. Une note d'honoraires est émise à chaque paiement.

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
Le Client reconnaît avoir reçu l'information relative à l'existence d'un médiateur de la consommation. Conformément aux articles L.612-1 et L.616-1 du Code de la consommation, il peut, en cas de différend avec le Cabinet et après une réclamation écrite adressée au Cabinet, recourir au ${MEDIATEUR}.

ARTICLE 7 — STIPULATIONS DIVERSES
La convention est conclue à distance, par voie électronique. La case d'acceptation cochée par le Client vaut signature ; la date, l'heure, la version et l'empreinte du texte accepté sont conservées et le Client peut relire à tout moment le texte exact accepté dans son espace. La convention est soumise au droit français.${d.dateLimite ? `\n\nDate limite ${d.appelDe ? "d'appel" : "de recours"} estimée au jour de la convention, sous réserve de vérification par l'avocat : ${d.dateLimite}.` : ""}
`;
}

/** Résumé en trois lignes affiché au-dessus de la case d'acceptation (cahier des charges, 4.10). */
export function resumeConvention(d: DonneesConvention): string[] {
  const total = d.lignes.reduce((s, l) => s + l.montant, 0);
  return [
    `Forfait ferme de ${formatEuros(total)}${d.horsUE ? "" : " TTC"} pour ${d.appelDe ? "toute l'instance d'appel, plaidoirie comprise" : d.recoursPrealable ? "le recours préalable, jusqu'à la réponse de l'administration" : "toute la première instance, plaidoirie comprise"}.`,
    "Un avocat du cabinet examine le dossier, rédige, atteste et dépose l'acte.",
    "Délai déjà expiré au jour du paiement : remboursement, 69 € conservés pour l'avis écrit.",
  ];
}
