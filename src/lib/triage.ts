// Triage par l'IA : comprendre la situation (récit écrit, dicté, ou photo de la décision)
// et proposer la procédure adaptée. Cahier des charges, sections 4.1, 4.8 et 14.2.
//
// Minimisation (niveau 2) : les coordonnées et numéros d'identification présents dans le récit
// sont masqués AVANT l'envoi au modèle. Les photos de décisions sont transmises telles quelles,
// leur lecture étant nécessaire à l'analyse.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
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
  // Pour l'affichage : faits et information générale traduits dans la langue du récit, si ce n'est pas le français.
  traduction: z.object({ langue: z.string(), faits: z.array(z.string()), obtenir: z.string() }).nullable().optional(),
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

const CONSIGNE = `Tu es l'outil d'orientation de LEXPATRIA Avocats, plateforme de dépôt de dossier en ligne d'un cabinet d'avocats au barreau de Paris, en contentieux du droit des étrangers.
Tu lis le récit d'une personne (dans n'importe quelle langue) et, le cas échéant, la photo de la décision qu'elle a reçue. Tu identifies la procédure adaptée parmi :
- OQTF : obligation de quitter le territoire français (avec ou sans refus de titre).
- REFUS_TITRE : refus de titre de séjour ou de certificat de résidence algérien, sans OQTF.
- REFUS_VISA : refus de visa (court ou long séjour).
- NATURALISATION : refus ou ajournement de naturalisation.
- REFUS_IMPLICITE : la préfecture ne répond pas à une demande de titre déposée.
- BLOCAGE_EMPLOI : impossible d'obtenir un rendez-vous ou récépissé expiré, ET emploi menacé.
- BLOCAGE_SIMPLE : impossible d'obtenir un rendez-vous ou récépissé expiré, sans emploi menacé.
- PROCEDURE_EN_COURS : un recours a déjà été déposé devant le tribunal.
- DIAGNOSTIC : la situation n'est pas assez claire pour choisir.
- HORS_PERIMETRE : asile (ASILE), admission exceptionnelle au séjour (AES), juge judiciaire (JUDICIAIRE), autre (AUTRE).
Règles :
- Si la personne est en prison, en détention ou en centre de rétention (CRA), mets detentionOuRetention à true.
- N'invente aucun fait, aucune date. Une date absente vaut null. Les dates sont au format AAAA-MM-JJ.
- "faits" : au plus 8 faits du récit qui comptent (ancienneté du séjour, vie familiale, enfants, emploi), formulés brièvement en français, sans les embellir.
- "ceQueLeRecoursPeutObtenir" : une ou deux phrases d'information générale en français (ex. pour une OQTF : le recours formé dans le délai empêche en principe l'éloignement jusqu'au jugement, sauf exceptions que l'avocat vérifie, et le tribunal peut annuler la décision). Jamais d'argument juridique, jamais de pronostic, jamais les mots « gratuit », « garanti », « offert ».
- "langue" : code ISO 639-1 de la langue du récit (celle dans laquelle la personne a écrit, pas celle des mots cités).
- "traduction" : si la langue du récit n'est pas le français, { "langue": code ISO 639-1, "faits": les mêmes faits traduits dans cette langue, "obtenir": "ceQueLeRecoursPeutObtenir" traduit dans cette langue } ; sinon null.
- Un refus de titre SANS obligation de quitter le territoire est REFUS_TITRE, jamais OQTF.
- "visaType" : COURT (moins de 90 jours, tourisme, visite) ou LONG (études, conjoint, travail, regroupement) si le récit le dit, sinon null.
- "naturalisationIssue" : REFUS ou AJOURNEMENT si le récit le dit, sinon null.
- "emploiMenace" : true seulement si le récit dit que l'emploi ou le contrat de travail est menacé, false s'il dit le contraire, sinon null.
- "dateEcheance" : pour une procédure en cours, la prochaine date fixée par le tribunal (mémoire à produire, audience), sinon null.
Réponds UNIQUEMENT par un objet JSON conforme à ce schéma : ${JSON.stringify(Object.keys(ResultatTriage.shape))}.`;

export interface EntreeTriage {
  recit?: string;
  images?: { mime: "image/jpeg" | "image/png" | "image/webp"; base64: string }[];
  pdfs?: { base64: string }[];
}

export async function trier(entree: EntreeTriage, client = new Anthropic(), modele?: string): Promise<ResultatTriage> {
  const contenu: Anthropic.Messages.ContentBlockParam[] = [];
  for (const img of entree.images ?? []) {
    contenu.push({ type: "image", source: { type: "base64", media_type: img.mime, data: img.base64 } });
  }
  for (const pdf of entree.pdfs ?? []) {
    contenu.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.base64 } });
  }
  contenu.push({
    type: "text",
    text: entree.recit ? `Récit de la personne :\n${minimiser(entree.recit)}` : "La personne a seulement transmis sa décision.",
  });

  const rep = await client.messages.create({
    model: modele ?? process.env.ANTHROPIC_MODEL_TRIAGE ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
    max_tokens: 1500,
    system: CONSIGNE,
    messages: [
      { role: "user", content: contenu },
      { role: "assistant", content: "{" },
    ],
  });
  const texte = "{" + rep.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const json = JSON.parse(texte.slice(0, texte.lastIndexOf("}") + 1));
  const res = ResultatTriage.parse(json);

  // Filet déontologique sur le seul texte destiné au public.
  if (controlerTexte(res.ceQueLeRecoursPeutObtenir).length > 0) {
    res.ceQueLeRecoursPeutObtenir = "";
    if (res.traduction) res.traduction.obtenir = "";
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
    ceQueLeRecoursPeutObtenir: procedure === "OQTF" ? "" : "",
  };
}
