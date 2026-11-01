// Triage par l'IA : comprendre la situation (récit écrit, dicté, ou photo de la décision)
// et proposer la procédure adaptée. Cahier des charges, sections 4.1, 4.8 et 14.2.
//
// Minimisation (niveau 2) : les coordonnées et numéros d'identification présents dans le récit
// sont masqués AVANT l'envoi au modèle. Les photos de décisions sont transmises telles quelles,
// leur lecture étant nécessaire à l'analyse.

import { extraireJson } from "@/lib/ia";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CAS_DEFAUT, casDepuisLibre, schemaCasLibre, trouverCas, type Cas } from "./cas";
import { controlerTexte } from "./deontologie";

export const ResultatTriage = z.object({
  procedure: z.enum([
    "OQTF",
    "REFUS_TITRE",
    "REFUS_VISA",
    "NATURALISATION",
    "REFUS_IMPLICITE",
    "BLOCAGE_EMPLOI",
    "BLOCAGE_SIMPLE",
    "PROCEDURE_EN_COURS",
    "DIAGNOSTIC",
    "HORS_PERIMETRE",
  ]),
  horsPerimetreMotif: z.enum(["ASILE", "AES", "JUDICIAIRE", "AUTRE"]).nullable(),
  situationOQTF: z.enum(["LIBRE", "ASSIGNE", "DETENTION", "RETENTION", "LIBRE_APRES_ASILE"]).nullable(),
  detentionOuRetention: z.boolean(),
  dateDecision: z.string().nullable(), // AAAA-MM-JJ
  dateNotification: z.string().nullable(),
  dateDemande: z.string().nullable(), // refus implicite
  dateEcheance: z.string().nullable(), // procédure en cours : prochaine échéance du tribunal
  visaType: z.enum(["COURT", "LONG"]).nullable(),
  naturalisationIssue: z.enum(["REFUS", "AJOURNEMENT"]).nullable(),
  emploiMenace: z.boolean().nullable(),
  prefecture: z.string().nullable(),
  nationaliteAlgerienne: z.boolean().nullable(),
  langue: z.string(),
  faits: z.array(z.string()).max(8), // faits qui comptent, tirés du récit, à confirmer par le client
  ceQueLeRecoursPeutObtenir: z.string(), // information générale, ni argument ni pronostic
  // Cas du référentiel reconnu (code), ou null si aucun ne correspond ; procédure alors la plus proche.
  cas: z.string().nullable().default(null),
  confiance: z.enum(["HAUTE", "MOYENNE", "FAIBLE"]).default("MOYENNE"),
  // Qualification pour l'avocat : ce que la décision ou le récit établit, et ce qui reste à vérifier.
  qualification: z
    .object({
      decision: z.string(), // nature exacte de la décision ou de la difficulté
      autorite: z.string().nullable(),
      mesures: z.array(z.string()).max(8), // OQTF, délai de départ, pays de renvoi, IRTF, assignation…
      motif: z.string().nullable(), // motif principal tel qu'il est écrit
      aVerifier: z.array(z.string()).max(6), // points incertains que l'avocat doit vérifier
    })
    .nullable()
    .default(null),
  // Note au client sur SA situation (2 ou 3 phrases), avec ou sans décision jointe.
  noteClient: z.string().default(""),
  // Qualification rédigée par l'IA quand aucun cas du référentiel ne correspond (validée ensuite contre le schéma).
  casLibre: z.unknown().nullable().default(null),
  // Question de précision, quand une seule réponse permet de trancher entre plusieurs cas.
  question: z.object({ texte: z.string().min(5).max(300), options: z.array(z.string().min(1).max(120)).min(2).max(4) }).nullable().default(null),
  // Pré-analyse personnalisée de la décision jointe (2 à 4 phrases), vide sans décision.
  preAnalyse: z.string().default(""),
  // Pour l'affichage : faits et information générale traduits dans la langue du récit, si ce n'est pas le français.
  traduction: z
    .object({ langue: z.string(), faits: z.array(z.string()), obtenir: z.string(), preAnalyse: z.string().optional(), note: z.string().optional(), cas: z.string().optional(), voie: z.string().optional() })
    .nullable()
    .optional(),
});
export type ResultatTriage = z.infer<typeof ResultatTriage>;

const MASQUES: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-mail]"],
  [/(?:\+|00)\d[\d\s.-]{7,}\d/g, "[téléphone]"],
  [/\b0[1-9](?:[\s.-]?\d{2}){4}\b/g, "[téléphone]"],
  [/\b\d{10}\b/g, "[numéro]"], // numéro d'étranger (AGDREF)
  [/\b[A-Z0-9]{2}\d{6,7}\b/g, "[numéro]"], // passeport
];

export function minimiser(texte: string): string {
  return MASQUES.reduce((t, [re, rempl]) => t.replace(re, rempl), texte);
}

function consigne(referentiel: Cas[]): string {
  const cas = referentiel
    .filter((c) => c.actif)
    .map((c) => `- ${c.code} [procédure ${c.procedure}] : ${c.libelle}. Signes : ${c.signes}`)
    .join("\n");
  return `Tu es l'outil d'orientation de LEXPATRIA Avocats, plateforme de dépôt de dossier en ligne d'un cabinet d'avocats au barreau de Paris, en contentieux du droit des étrangers.
Tu lis le récit d'une personne (dans n'importe quelle langue) et, le cas échéant, la photo de la décision qu'elle a reçue. Tu identifies la procédure adaptée parmi :
- OQTF : obligation de quitter le territoire français (avec ou sans refus de titre).
- REFUS_TITRE : refus de titre de séjour ou de certificat de résidence algérien, sans OQTF.
- REFUS_VISA : refus de visa (court ou long séjour).
- NATURALISATION : refus ou ajournement de naturalisation.
- REFUS_IMPLICITE : la préfecture ne répond pas à une demande de TITRE DE SÉJOUR déposée (jamais pour une naturalisation ni un visa, qui ont leurs propres cas).
- BLOCAGE_EMPLOI : impossible d'obtenir un rendez-vous ou récépissé expiré, ET emploi menacé.
- BLOCAGE_SIMPLE : impossible d'obtenir un rendez-vous ou récépissé expiré, sans emploi menacé.
- PROCEDURE_EN_COURS : un recours a déjà été déposé devant le tribunal.
- DIAGNOSTIC : uniquement si l'on ne peut pas savoir quel type de décision ou de difficulté la personne rencontre.
- HORS_PERIMETRE : asile (ASILE), admission exceptionnelle au séjour (AES), juge judiciaire (JUDICIAIRE), autre (AUTRE).
CAS DU RÉFÉRENTIEL DU CABINET (rattache la situation à l'un d'eux) :
${cas}
Règles de qualification :
- Lis la décision jointe en entier (en-tête, visas, motifs, dispositif, articles, mention des voies et délais) avant de conclure : l'article cité (par exemple L. 611-1, 3° ou 4° du CESEDA), l'autorité, les mesures et le motif déterminent le cas.
- "cas" : le code du cas qui correspond EXACTEMENT à la situation. La "procedure" est alors celle indiquée entre crochets pour ce cas. Si aucun cas ne correspond, "cas" vaut null et "procedure" est la procédure la plus proche ; "confiance" vaut alors "FAIBLE" et "qualification.aVerifier" explique pourquoi.
- "confiance" : HAUTE si la décision jointe ou un récit précis établit le cas ; MOYENNE si le récit l'indique sans décision ; FAIBLE si plusieurs cas restent possibles.
- Un recours contre un refus suppose une décision de rejet : décision EXPLICITE reçue, ou décision IMPLICITE née du silence de l'administration au-delà du délai légal, à compter d'un point de départ établi (demande de titre enregistrée : quatre mois ; naturalisation : dix-huit mois, douze mois après dix ans de résidence, à compter du récépissé de complétude ; visa : deux mois après le dépôt ; recours administratif : deux mois). Une demande en cours dont le délai n'a pas expiré, ou dont le point de départ n'existe pas encore (par exemple naturalisation au statut « dossier envoyé », sans récépissé), n'a fait naître aucun refus : choisis alors le cas de blocage qui correspond (mise en demeure, référé). En cas de refus implicite, indique dans "qualification.aVerifier" le point de départ et la date de naissance retenus.
- Distingue avec soin : refus de titre AVEC OQTF (cas OQTF) / refus SANS OQTF ; première demande / renouvellement / changement de statut / retrait ; refus de regroupement familial par le préfet / refus de visa famille par le consulat ; visa court / long séjour ; naturalisation par décret (administratif) / déclaration de nationalité (juge judiciaire, hors périmètre) ; recours déjà déposé / jugement déjà rendu.
- Blocages en préfecture : distingue (1) le blocage qui appelle un RÉFÉRÉ MESURES UTILES (rendez-vous impossible, demande non enregistrée, récépissé non délivré ou non renouvelé, titre accordé mais non remis : l'administration n'accomplit pas une démarche due, sans conséquence grave dans les tout prochains jours) et (2) celui qui appelle un RÉFÉRÉ-LIBERTÉ (documents retenus par l'administration, retour en France impossible, ou blocage qui entraîne dans les jours qui viennent une atteinte grave : licenciement imminent, perte du logement ou des ressources, séparation familiale, alors que la personne remplit manifestement les conditions). En cas de doute, retiens le référé mesures utiles et indique-le dans "aVerifier".
- Une demande d'asile, un transfert « Dublin » ou un recours devant l'OFPRA ou la CNDA est HORS_PERIMETRE (ASILE). Le souhait de DÉPOSER une demande de régularisation est HORS_PERIMETRE (AES) ; en revanche, le REFUS d'une demande de régularisation se conteste (cas de refus de titre ou d'OQTF).
- "qualification" : toujours remplie (sauf HORS_PERIMETRE) ; "decision" en une phrase précise (ex. « Arrêté du préfet du Val-de-Marne refusant le renouvellement d'un titre de séjour salarié, portant OQTF dans un délai de trente jours »), "autorite" (préfet de…, consulat de…, ministre…), "mesures" (OQTF, délai de départ volontaire, pays de renvoi, interdiction de retour et sa durée, assignation à résidence), "motif" tel qu'il est écrit, "aVerifier" les points que l'avocat doit contrôler (date de notification absente, page manquante, fondement incertain…). En français, style d'avocat, sans pronostic.
Règles :
- Dès que le type de décision ou de difficulté est identifiable (ex. « j'ai reçu une OQTF », « refus de visa », « la préfecture ne répond pas »), choisis la procédure correspondante, même si la date, la situation ou les autres détails manquent : ils seront demandés ensuite à la personne. Ne choisis jamais DIAGNOSTIC pour un simple manque de détails.
- Si la personne est en prison, en détention ou en centre de rétention (CRA), mets detentionOuRetention à true.
- N'invente aucun fait, aucune date. Une date absente vaut null. Les dates sont au format AAAA-MM-JJ.
- "faits" : au plus 8 faits du récit qui comptent (ancienneté du séjour, vie familiale, enfants, emploi), formulés brièvement en français, sans les embellir.
- "ceQueLeRecoursPeutObtenir" : une ou deux phrases d'information générale en français (ex. pour une OQTF : le recours formé dans le délai empêche en principe l'éloignement jusqu'au jugement, sauf exceptions que l'avocat vérifie, et le tribunal peut annuler la décision). Jamais d'argument juridique, jamais de pronostic, jamais les mots « gratuit », « garanti », « offert ».
- "preAnalyse" : seulement si une décision est jointe ; sinon "". Deux à quatre phrases complètes en français, rédigées à la troisième personne pour le cabinet (« la décision », « le cabinet », « votre avocat » ; jamais « nous »), adressées à la personne (« vous »), sur ce que dit SA décision : l'autorité et la nature de la décision, sa date et, si elle figure, la date de notification ; le délai de recours indiqué dans la mention des voies et délais ; les mesures qui l'accompagnent (délai de départ volontaire, interdiction de retour, pays de renvoi) ; le motif principal tel qu'il est écrit. Exemple de ton : « Le préfet de police vous fait obligation de quitter le territoire français dans un délai de trente jours, par une décision du 3 octobre 2026 notifiée le 6 octobre. ». Aucun argument juridique, aucun pronostic, aucune promesse. Style d'avocat, sobre et précis : pas de phrases hachées, pas de formules d'empathie.
- "noteClient" : sauf HORS_PERIMETRE, deux ou trois phrases en français adressées à la personne (« vous »), qui montrent que sa situation a été comprise : reprends les éléments concrets de SON récit (nature de la décision ou du blocage, ancienneté, famille, emploi, études, démarche engagée, échéance) puis indique la démarche que votre avocat engagera dans son cas et son objet. Si une décision est jointe, la "preAnalyse" la décrit déjà : la note ne la répète pas. Troisième personne pour le cabinet (« votre avocat », « le cabinet », jamais « nous »). Aucun pronostic, aucune promesse, aucune formule d'empathie, aucune phrase générale qui vaudrait pour tout le monde, aucun fait inventé. Exemple de ton : « Vous vivez en France depuis 2017 et la préfecture refuse de renouveler votre titre de séjour salarié alors que vous êtes en contrat à durée indéterminée. Votre avocat contestera ce refus devant le tribunal administratif et demandera en urgence la suspension de ses effets, afin que vous puissiez conserver votre emploi pendant la procédure. »
- "casLibre" : uniquement si AUCUN cas du référentiel ne correspond ("cas" null) et hors HORS_PERIMETRE ; sinon null. Rédige alors toi-même la qualification, dans le même cadre que les fiches : {"libelle": situation en une ligne, "voieClient": voie de recours en une ligne, "procedure": l'une de ${"OQTF, REFUS_TITRE, REFUS_VISA, NATURALISATION, REFUS_IMPLICITE, BLOCAGE_SIMPLE, BLOCAGE_EMPLOI, PROCEDURE_EN_COURS, DIAGNOSTIC"} (elle détermine les honoraires : requête au tribunal, recours préalable, mise en demeure, référé, reprise, diagnostic), "situationOQTF": null ou LIBRE/ASSIGNE/LIBRE_APRES_ASILE, "visaType": null/COURT/LONG, "naturalisationIssue": null/REFUS/AJOURNEMENT, "signes": indices généraux permettant de reconnaître ce type de situation, sans aucune donnée personnelle, "juridiction", "delai" (texte, avec la règle et son point de départ), "refere": null/MESURES_UTILES/LIBERTE (blocages seulement), "implicite": true si le recours vise une décision implicite de rejet, "complements": [] ou ["REFERE_SUSPENSION_AVEC_REQUETE"] si la décision prive d'un droit en cours (renouvellement, retrait), "modele": l'un de REQUETE_OQTF, REQUETE_REFUS_TITRE, REQUETE_SOMMAIRE, MEMOIRE_COMPLEMENTAIRE, REFERE_SUSPENSION, REFERE_LIBERTE, REFERE_MESURES_UTILES, RECOURS_GRACIEUX, RAPO_VISA, RAPO_NATURALISATION, MISE_EN_DEMEURE, AVIS_ECRIT, "vigilance": points à vérifier par l'avocat}. Si aucune de ces procédures ne convient, choisis DIAGNOSTIC (avis écrit d'un avocat).
- "question" : seulement si "confiance" serait FAIBLE et qu'UNE question fermée permet de trancher (ex. « Avez-vous reçu une décision écrite ? », « Votre dossier est-il passé au statut "en instruction" ? »). {"texte": la question, "options": deux à quatre réponses courtes}, dans la langue du récit. Sinon null. Ne pose jamais de question si des précisions ont déjà été apportées deux fois.
- "langue" : code ISO 639-1 de la langue du récit (celle dans laquelle la personne a écrit, pas celle des mots cités).
- "traduction" : si la langue du récit n'est pas le français, { "langue": code ISO 639-1, "faits": les mêmes faits traduits dans cette langue, "obtenir": "ceQueLeRecoursPeutObtenir" traduit dans cette langue, "preAnalyse": "preAnalyse" traduite dans cette langue, "note": "noteClient" traduite dans cette langue } ; sinon null.
- Un refus de titre SANS obligation de quitter le territoire est REFUS_TITRE, jamais OQTF.
- "visaType" : COURT (moins de 90 jours, tourisme, visite) ou LONG (études, conjoint, travail, regroupement) si le récit le dit, sinon null.
- "naturalisationIssue" : REFUS ou AJOURNEMENT si le récit le dit, sinon null.
- "emploiMenace" : true seulement si le récit dit que l'emploi ou le contrat de travail est menacé, false s'il dit le contraire, sinon null.
- "dateEcheance" : pour une procédure en cours, la prochaine date fixée par le tribunal (mémoire à produire, audience), sinon null.
- "traduction" comprend aussi, si la langue du récit n'est pas le français, "cas" (le libellé du cas reconnu, traduit) et "voie" (sa voie de recours, traduite).
Réponds UNIQUEMENT par un objet JSON conforme à ce schéma : ${JSON.stringify(Object.keys(ResultatTriage.shape))}.`;
}

export interface EntreeTriage {
  recit?: string;
  /** Réponses de la personne aux questions de précision (deux au plus). */
  precisions?: { question: string; reponse: string }[];
  /** Procédure choisie par la personne parmi les situations courantes, avant de transmettre sa décision. */
  procedure?: string;
  images?: { mime: "image/jpeg" | "image/png" | "image/webp"; base64: string }[];
  pdfs?: { base64: string }[];
}

const precisionsEpuisees = (e: EntreeTriage) => (e.precisions?.length ?? 0) >= 2;

export async function trier(entree: EntreeTriage, client = new Anthropic(), modele?: string, referentiel: Cas[] = CAS_DEFAUT): Promise<ResultatTriage> {
  const contenu: Anthropic.Messages.ContentBlockParam[] = [];
  for (const img of entree.images ?? []) {
    contenu.push({ type: "image", source: { type: "base64", media_type: img.mime, data: img.base64 } });
  }
  for (const pdf of entree.pdfs ?? []) {
    contenu.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.base64 } });
  }
  contenu.push({
    type: "text",
    text:
      (entree.recit ? `Récit de la personne :\n${minimiser(entree.recit)}` : "La personne a seulement transmis sa décision.") +
      (entree.precisions?.length
        ? `\nPrécisions apportées par la personne :\n${entree.precisions.map((p) => `- ${p.question} → ${p.reponse}`).join("\n")}` +
          (entree.precisions.length >= 2 ? "\nNe pose plus de question : qualifie avec ces éléments." : "")
        : "") +
      (entree.procedure ? `\nSituation choisie par la personne : ${entree.procedure}. Retiens-la sauf si la décision jointe dit clairement autre chose.` : ""),
  });

  const rep = await client.messages.create({
    model: modele ?? process.env.ANTHROPIC_MODEL_TRIAGE ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
    max_tokens: 4000,
    system: consigne(referentiel),
    messages: [
      { role: "user", content: contenu },
    ],
  });
  const json = extraireJson(rep.content);
  const res = ResultatTriage.parse(json);
  // Filet : si le récit nomme clairement la décision (mots-clés français), on ne laisse pas l'orientation en diagnostic.
  // Une décision défavorable doit être nommée (refus, rejet, ajournement, OQTF) : une demande en cours n'est jamais un refus.
  if (res.procedure === "DIAGNOSTIC" && !res.cas && entree.recit) {
    const motsCles = trierSimule(entree.recit).procedure;
    const decisionNommee = /refus|rejet|ajourn|oqtf|quitter le territoire/i.test(entree.recit);
    const exigeDecision = ["OQTF", "REFUS_TITRE", "REFUS_VISA", "NATURALISATION"].includes(motsCles);
    if (motsCles !== "DIAGNOSTIC" && (!exigeDecision || decisionNommee)) res.procedure = motsCles;
  }

  // Garde-fou de matière : une demande de naturalisation ne relève jamais des procédures propres aux titres de séjour.
  // Sans décision défavorable nommée, c'est une demande restée sans suite (la fiche rappelle à l'avocat de vérifier un rejet implicite).
  if (!res.cas && !res.casLibre && entree.recit && /naturali|nationalit/i.test(entree.recit) && res.procedure !== "HORS_PERIMETRE" && res.procedure !== "NATURALISATION") {
    const decision = /refus|rejet|ajourn|irrecevab/i.test(entree.recit);
    const code = decision ? "NATURALISATION_REFUS" : "NATURALISATION_SANS_SUITE";
    if (trouverCas(referentiel, code)) {
      res.cas = code;
      res.confiance = "FAIBLE";
      if (res.qualification) res.qualification.aVerifier.push("Orientation rectifiée vers la naturalisation : vérifier la qualification.");
    }
  }

  // Cohérence avec le référentiel : le cas reconnu fixe la procédure et les éléments qu'il détermine.
  // À défaut, la qualification libre de l'IA, validée contre le même schéma, joue le même rôle.
  const reconnu = trouverCas(referentiel, res.cas);
  if (res.cas && !reconnu) {
    res.cas = null;
    res.confiance = "FAIBLE";
  }
  const libre = !reconnu && res.casLibre ? schemaCasLibre.safeParse(res.casLibre) : null;
  res.casLibre = libre?.success && controlerTexte([libre.data.libelle, libre.data.voieClient].join(" ")).length === 0 ? libre.data : null;
  const cas = reconnu ?? (res.casLibre ? casDepuisLibre(schemaCasLibre.parse(res.casLibre)) : undefined);
  if (precisionsEpuisees(entree)) res.question = null;
  if (cas && res.procedure !== "HORS_PERIMETRE") {
    res.procedure = cas.procedure;
    if (cas.situationOQTF) res.situationOQTF = cas.situationOQTF;
    if (cas.visaType) res.visaType = cas.visaType;
    if (cas.naturalisationIssue) res.naturalisationIssue = cas.naturalisationIssue;
    // Référé-liberté : l'urgence est inhérente au cas ; référé mesures utiles : l'urgence est demandée au client.
    if (cas.refere === "LIBERTE") {
      res.procedure = "BLOCAGE_EMPLOI";
      res.emploiMenace = true;
    } else if (cas.refere === "MESURES_UTILES" && !cas.demanderUrgence) {
      // Urgence rarement caractérisée (naturalisation, par exemple) : mise en demeure, l'avocat apprécie la suite.
      res.procedure = "BLOCAGE_SIMPLE";
      res.emploiMenace = false;
    }
  }

  // Filet déontologique sur le seul texte destiné au public.
  if (controlerTexte(res.ceQueLeRecoursPeutObtenir).length > 0) {
    res.ceQueLeRecoursPeutObtenir = "";
    if (res.traduction) res.traduction.obtenir = "";
  }
  if (controlerTexte(res.noteClient).length > 0) {
    res.noteClient = "";
    if (res.traduction) res.traduction.note = "";
  }
  if (controlerTexte(res.preAnalyse).length > 0) {
    res.preAnalyse = "";
    if (res.traduction) res.traduction.preAnalyse = "";
  }
  return res;
}

/** Orientation simulée, pour le développement et les tests sans clé API. Jamais utilisée en production. */
export function trierSimule(recit: string): ResultatTriage {
  const r = recit.toLowerCase();
  const date = recit.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const sansOqtf = /sans (oqtf|obligation de quitter)/.test(r);
  const procedure: ResultatTriage["procedure"] = /oqtf|quitter le territoire/.test(r) && !sansOqtf
    ? "OQTF"
    : /visa/.test(r)
      ? "REFUS_VISA"
      : /naturalisation/.test(r)
        ? "NATURALISATION"
        : /tribunal|recours (d[ée]j[àa]|en cours)|m[ée]moire/.test(r)
          ? "PROCEDURE_EN_COURS"
          : /r[ée]c[ée]piss[ée]|rendez-vous/.test(r)
            ? /licenci|perdre mon (emploi|travail)/.test(r) ? "BLOCAGE_EMPLOI" : "BLOCAGE_SIMPLE"
            : /ne r[ée]pond|aucune r[ée]ponse|pas de r[ée]ponse|silence/.test(r)
              ? "REFUS_IMPLICITE"
              : /refus/.test(r)
                ? "REFUS_TITRE"
                : "DIAGNOSTIC";
  return {
    procedure,
    horsPerimetreMotif: null,
    situationOQTF: null,
    detentionOuRetention: /prison|d[ée]tenu|maison d'arr[êe]t|r[ée]tention|\bcra\b/.test(r),
    dateDecision: null,
    dateNotification: date,
    dateDemande: null,
    dateEcheance: null,
    visaType: /long s[ée]jour|conjoint|[ée]tudiant|regroupement/.test(r) ? "LONG" : /court s[ée]jour|touris|visite/.test(r) ? "COURT" : null,
    naturalisationIssue: /ajourn/.test(r) ? "AJOURNEMENT" : /naturalisation/.test(r) ? "REFUS" : null,
    emploiMenace: /licenci|perdre mon (emploi|travail)/.test(r) ? true : null,
    prefecture: null,
    nationaliteAlgerienne: /alg[ée]rien/.test(r) ? true : null,
    langue: "fr",
    faits: [],
    ceQueLeRecoursPeutObtenir: "",
    cas: null,
    confiance: "FAIBLE",
    qualification: null,
    casLibre: null,
    question: null,
    noteClient: "",
    preAnalyse: "",
  };
}
