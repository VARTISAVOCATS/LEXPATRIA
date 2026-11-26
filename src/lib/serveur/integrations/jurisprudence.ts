// Recherche de jurisprudence et vérification des textes par l'IA, via la plateforme PISTE (DILA et Cour de cassation) :
// - Légifrance : jurisprudence administrative (fonds « CETAT » : Conseil d'État, cours administratives d'appel,
//   sélection de jugements de tribunaux administratifs) et articles de codes en vigueur ;
// - Judilibre : jurisprudence judiciaire (Cour de cassation, cours d'appel, tribunaux judiciaires), utile pour la
//   rétention, le juge des libertés et la nationalité.
// Une seule application PISTE abonnée aux deux API ; authentification OAuth « client credentials ».
// Sans identifiants : rien n'est appelé, l'acte est rédigé sans recherche.
// Aucune donnée du client n'est envoyée : seules des requêtes juridiques (mots-clés, numéros d'article) partent vers PISTE.

import type Anthropic from "@anthropic-ai/sdk";
import { valeur } from "../connexions";
import { appelJson, ErreurIntegration } from "./commun";

async function config() {
  const [id, secret, env] = await Promise.all(["PISTE_CLIENT_ID", "PISTE_CLIENT_SECRET", "PISTE_ENVIRONNEMENT"].map(valeur));
  if (!id?.trim() || !secret?.trim()) return null;
  const bac = (env ?? "").trim().toLowerCase() !== "production";
  return {
    id: id.trim(),
    secret: secret.trim(),
    bac,
    jeton: bac ? "https://sandbox-oauth.piste.gouv.fr/api/oauth/token" : "https://oauth.piste.gouv.fr/api/oauth/token",
    legifrance: bac ? "https://sandbox-api.piste.gouv.fr/dila/legifrance/lf-engine-app" : "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app",
    judilibre: bac ? "https://sandbox-api.piste.gouv.fr/cassation/judilibre/v1.0" : "https://api.piste.gouv.fr/cassation/judilibre/v1.0",
  };
}

export async function pisteConfiguree() {
  return (await config()) !== null;
}

let jetonCache: { cle: string; jeton: string; expire: number } | null = null;

async function jeton() {
  const c = await config();
  if (!c) throw new ErreurIntegration("Légifrance et Judilibre ne sont pas configurés.");
  const cle = `${c.id}:${c.bac}`;
  if (jetonCache && jetonCache.cle === cle && jetonCache.expire > Date.now() + 60_000) return { c, jeton: jetonCache.jeton };
  const r = await appelJson<{ access_token: string; expires_in?: number }>(c.jeton, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: c.id, client_secret: c.secret, scope: "openid" }),
  });
  jetonCache = { cle, jeton: r.access_token, expire: Date.now() + (r.expires_in ?? 3600) * 1000 };
  return { c, jeton: r.access_token };
}

async function legifrance<T>(chemin: string, corps: object): Promise<T> {
  const { c, jeton: j } = await jeton();
  return appelJson<T>(`${c.legifrance}${chemin}`, {
    method: "POST",
    headers: { authorization: `Bearer ${j}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(corps),
  });
}

async function judilibre<T>(chemin: string, params: Record<string, string>): Promise<T> {
  const { c, jeton: j } = await jeton();
  return appelJson<T>(`${c.judilibre}${chemin}?${new URLSearchParams(params)}`, { headers: { authorization: `Bearer ${j}`, accept: "application/json" } });
}

// ---------- Lecture tolérante des réponses ----------

const sansHtml = (t: string) =>
  t
    .replace(/<br\s*\/?>|<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Toutes les chaînes trouvées sous des clés données, à n'importe quelle profondeur. */
function chaines(x: unknown, cles: string[], max = 6): string[] {
  const res: string[] = [];
  const voir = (v: unknown, cle?: string) => {
    if (res.length >= max || v == null) return;
    if (typeof v === "string") {
      if (cle && cles.includes(cle) && v.trim()) res.push(sansHtml(v).slice(0, 600));
      return;
    }
    if (Array.isArray(v)) return v.forEach((e) => voir(e, cle));
    if (typeof v === "object") for (const [k, e] of Object.entries(v as Record<string, unknown>)) voir(e, k);
  };
  voir(x);
  return res;
}

function premierId(x: unknown, prefixe: string): string | null {
  let trouve: string | null = null;
  const voir = (v: unknown) => {
    if (trouve || v == null) return;
    if (typeof v === "string") {
      if (v.startsWith(prefixe)) trouve = v;
      return;
    }
    if (Array.isArray(v)) return v.forEach(voir);
    if (typeof v === "object") Object.values(v as Record<string, unknown>).forEach(voir);
  };
  voir(x);
  return trouve;
}

// ---------- Recherches ----------

export interface DecisionTrouvee {
  source: "LEGIFRANCE" | "JUDILIBRE" | "OPENDATA";
  id: string;
  titre: string;
  extraits: string[];
}

/** Jurisprudence administrative (Légifrance, fonds CETAT). */
export async function rechercherAdministrative(requete: string, taille = 8): Promise<DecisionTrouvee[]> {
  const r = await legifrance<{ results?: unknown[] }>("/search", {
    fond: "CETAT",
    recherche: {
      champs: [{ typeChamp: "ALL", criteres: [{ typeRecherche: "TOUS_LES_MOTS_DANS_UN_CHAMP", valeur: requete.slice(0, 300), operateur: "ET" }], operateur: "ET" }],
      filtres: [],
      pageNumber: 1,
      pageSize: Math.min(taille, 15),
      operateur: "ET",
      sort: "PERTINENCE",
      typePagination: "DEFAUT",
    },
  });
  return (r.results ?? [])
    .map((x) => {
      const o = x as { titles?: { id?: string; title?: string }[]; id?: string; title?: string };
      const id = o.titles?.[0]?.id ?? o.id ?? premierId(x, "CETATEXT") ?? "";
      const titre = sansHtml(o.titles?.[0]?.title ?? o.title ?? "");
      return { source: "LEGIFRANCE" as const, id, titre, extraits: chaines(x, ["values", "text", "extract", "resume"], 3) };
    })
    .filter((x) => x.id && x.titre);
}

/** Texte d'une décision administrative (Légifrance) : titre, sommaire, extrait des motifs et du dispositif. */
export async function lireDecisionAdministrative(id: string): Promise<{ titre: string; texte: string; lien: string }> {
  const r = await legifrance<{ text?: Record<string, unknown> }>("/consult/juri", { textId: id });
  const t = r.text ?? {};
  const titre = sansHtml(String(t.titre ?? t.title ?? id));
  const sommaire = chaines(t.sommaire ?? t.resumePrincipal ?? null, ["resumePrincipal", "resume", "texte", "value"], 4).join("\n");
  const corps = sansHtml(String(t.texteHtml ?? t.texte ?? t.text ?? ""));
  // Les motifs utiles sont souvent à la fin : début et fin du texte.
  const texte = corps.length > 9000 ? `${corps.slice(0, 3500)}\n[…]\n${corps.slice(-5000)}` : corps;
  return { titre, texte: `${sommaire ? `SOMMAIRE : ${sommaire}\n\n` : ""}${texte}`, lien: `https://www.legifrance.gouv.fr/ceta/id/${id}` };
}

/** Article d'un code, dans sa version en vigueur aujourd'hui. */
export async function lireArticle(code: string, numero: string): Promise<{ titre: string; texte: string; lien: string } | null> {
  const r = await legifrance<unknown>("/search", {
    fond: "CODE_DATE",
    recherche: {
      champs: [{ typeChamp: "NUM_ARTICLE", criteres: [{ typeRecherche: "EXACTE", valeur: numero.replace(/^art(icle)?\.?\s*/i, "").trim(), operateur: "ET" }], operateur: "ET" }],
      filtres: [
        { facette: "NOM_CODE", valeurs: [code] },
        { facette: "DATE_VERSION", singleDate: Date.now() },
      ],
      pageNumber: 1,
      pageSize: 3,
      operateur: "ET",
      sort: "PERTINENCE",
      typePagination: "ARTICLE",
    },
  });
  const id = premierId(r, "LEGIARTI");
  if (!id) return null;
  const a = await legifrance<{ article?: Record<string, unknown> }>("/consult/getArticle", { id });
  const art = a.article ?? {};
  return {
    titre: `${code}, article ${String(art.num ?? numero)}${art.etat ? ` (${String(art.etat).toLowerCase()})` : ""}`,
    texte: sansHtml(String(art.texteHtml ?? art.texte ?? "")).slice(0, 4000),
    lien: `https://www.legifrance.gouv.fr/codes/article_lc/${id}`,
  };
}

/** Jurisprudence judiciaire (Judilibre). */
export async function rechercherJudiciaire(requete: string, taille = 6): Promise<DecisionTrouvee[]> {
  const r = await judilibre<{ results?: Record<string, unknown>[] }>("/search", { query: requete.slice(0, 300), page_size: String(Math.min(taille, 10)) });
  return (r.results ?? []).map((x) => ({
    source: "JUDILIBRE" as const,
    id: String(x.id ?? ""),
    titre: [x.jurisdiction, x.chamber, x.decision_date, x.number].filter(Boolean).join(", "),
    extraits: [String(x.summary ?? ""), ...chaines(x.highlights ?? null, ["text"], 2)].filter((s) => s.trim()).map((s) => sansHtml(s).slice(0, 600)),
  }));
}

export async function lireDecisionJudiciaire(id: string): Promise<{ titre: string; texte: string; lien: string }> {
  const x = await judilibre<Record<string, unknown>>("/decision", { id });
  const corps = sansHtml(String(x.text ?? ""));
  return {
    titre: [x.jurisdiction, x.chamber, x.decision_date, x.number].filter(Boolean).join(", "),
    texte: `${x.summary ? `SOMMAIRE : ${sansHtml(String(x.summary))}\n\n` : ""}${corps.length > 9000 ? `${corps.slice(0, 3500)}\n[…]\n${corps.slice(-5000)}` : corps}`,
    lien: `https://www.courdecassation.fr/decision/${id}`,
  };
}

/** Essai de connexion : jeton, puis une recherche Légifrance et une recherche Judilibre. */
export async function testerPiste(): Promise<{ ok: boolean; message: string }> {
  const c = await config();
  if (!c) return { ok: false, message: "Identifiant et secret PISTE absents." };
  try {
    await jeton();
  } catch {
    return { ok: false, message: `PISTE refuse les identifiants (${c.bac ? "bac à sable" : "production"}) : vérifiez l'identifiant et le secret OAuth de l'application, et l'environnement choisi.` };
  }
  const env = c.bac ? "bac à sable (données de test)" : "production";
  const lf = await rechercherAdministrative("obligation de quitter le territoire vie privée et familiale", 1).then(
    (r) => `Légifrance répond (${r.length ? "jurisprudence trouvée" : "aucun résultat"})`,
    (e) => `Légifrance refuse l'accès : abonnez l'application à l'API « Légifrance » sur piste.gouv.fr (${String(e instanceof Error ? e.message : e).slice(0, 80)})`,
  );
  const jl = await rechercherJudiciaire("rétention administrative", 1).then(
    () => "Judilibre répond",
    () => "Judilibre refuse l'accès : abonnez l'application à l'API « JUDILIBRE » sur piste.gouv.fr",
  );
  return { ok: lf.startsWith("Légifrance répond"), message: `Identifiants acceptés (${env}). ${lf}. ${jl}.` };
}

// ---------- Open data de la juridiction administrative (sans clé) ----------
// Moteur de recherche public d'opendata.justice-administrative.fr : décisions pseudonymisées du Conseil d'État (depuis 2021),
// des cours administratives d'appel (depuis 2022) et des tribunaux administratifs (depuis 2022). Syntaxe des requêtes :
// « + » rend un mot obligatoire, les guillemets cherchent une expression exacte ; sans opérateur, les mots sont alternatifs.

const OPENDATA = "https://opendata.justice-administrative.fr/recherche/api";
const OPENDATA_SANS_SECOND = "bm9TZWNvbmR2YWx1ZQ=="; // « noSecondvalue », valeur attendue par le moteur

interface SourceOpenData {
  Identification?: string;
  Code_Juridiction?: string;
  Nom_Juridiction?: string;
  Numero_ECLI?: string;
  Formation_Jugement?: string;
  Numero_Dossier?: string;
  Date_Lecture?: string;
  Code_Publication?: string;
  paragraph?: string;
}
type ReponseOpenData = { decisions?: { body?: { hits?: { total?: { value?: number }; hits?: { _id: string; _source: SourceOpenData }[] } } } };

async function opendata(chemin: string): Promise<ReponseOpenData> {
  const r = await fetch(`${OPENDATA}${chemin}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`open data : ${r.status}`);
  return (await r.json()) as ReponseOpenData;
}

const dateFr = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const titreOpenData = (id: string, x: SourceOpenData) =>
  [x.Nom_Juridiction, x.Formation_Jugement, /^OR/.test(id) ? "ordonnance" : null, dateFr(x.Date_Lecture), x.Numero_Dossier ? `n° ${x.Numero_Dossier}` : null]
    .filter(Boolean)
    .join(", ");

/** Lien public vers la décision sur la plateforme open data. */
export const lienOpenData = (id: string) => `https://opendata.justice-administrative.fr/recherche/shareFile/${encodeURIComponent(id)}`;

/** Recherche dans les décisions des TA, CAA et du Conseil d'État ; juridiction facultative (TA75, CAA78, CE…). */
export async function rechercherOpenData(requete: string, juridiction?: string, taille = 10): Promise<DecisionTrouvee[]> {
  const q = encodeURIComponent(requete.trim().slice(0, 300));
  const juri = (juridiction ?? "").trim().toUpperCase();
  const chemin = /^(TA|CAA)\d{1,3}$|^CE$/.test(juri) ? `/model_search_juri/openData/${juri}/${q}/${taille}` : `/Simple_Search/openData/${q}/${taille}`;
  const r = await opendata(chemin);
  return (r.decisions?.body?.hits?.hits ?? []).slice(0, taille).map((h) => ({
    source: "OPENDATA" as const,
    id: h._id,
    titre: titreOpenData(h._id, h._source),
    extraits: [h._source.Code_Publication ? `Publication : ${h._source.Code_Publication}` : ""].filter(Boolean),
  }));
}

/** Texte d'une décision open data : début (conclusions) et fin (motifs et dispositif) si elle est longue. */
export async function lireDecisionOpenData(id: string): Promise<{ titre: string; texte: string; lien: string }> {
  const r = await opendata(`/elastic/decisions/${encodeURIComponent(id)}/${OPENDATA_SANS_SECOND}`);
  const h = r.decisions?.body?.hits?.hits?.[0];
  if (!h) throw new Error("décision introuvable");
  const corps = (h._source.paragraph ?? "").split("$$$").map((p) => p.trim()).filter(Boolean).join("\n");
  return {
    titre: titreOpenData(h._id, h._source),
    texte: corps.length > 11_000 ? `${corps.slice(0, 2500)}\n[…]\n${corps.slice(-8000)}` : corps,
    lien: lienOpenData(h._id),
  };
}

// ---------- Recherche menée par l'IA ----------

/** Outils de l'open data de la juridiction administrative (sans clé, toujours disponibles). */
export const OUTILS_OPENDATA: Anthropic.Tool[] = [
  {
    name: "rechercher_decisions_ta_caa",
    description:
      "Recherche dans toutes les décisions récentes des tribunaux administratifs, des cours administratives d'appel et du Conseil d'État (open data de la juridiction administrative, depuis 2022). " +
      "Indispensable pour la jurisprudence du tribunal compétent et de sa cour. Syntaxe : « + » devant chaque mot obligatoire, guillemets pour une expression exacte " +
      "(ex. « +OQTF +\"conjoint de nationalité française\" +annule »). Sans « + », les mots sont alternatifs et les résultats inexploitables. " +
      "Juridiction facultative : TA suivi du numéro du département du siège (TA75 Paris, TA93 Montreuil, TA95 Cergy-Pontoise, TA78 Versailles, TA77 Melun, TA13 Marseille, TA69 Lyon), " +
      "CAA suivi du département du siège (CAA75 Paris, CAA78 Versailles, CAA13 Marseille, CAA69 Lyon), ou CE. Renvoie identifiants et références (juridiction, formation, date, numéro). Aucune donnée personnelle du client.",
    input_schema: {
      type: "object",
      properties: {
        requete: { type: "string", description: "Mots-clés avec « + » et guillemets" },
        juridiction: { type: "string", description: "Code facultatif : TA75, TA93, CAA75, CE…" },
      },
      required: ["requete"],
    },
  },
  {
    name: "lire_decision_ta_caa",
    description: "Lit une décision trouvée par rechercher_decisions_ta_caa (identifiant tel que DTA_2601827_20261119.xml_TA76) : conclusions, motifs et dispositif, pour vérifier la solution avant de la citer.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

export const OUTILS_RECHERCHE: Anthropic.Tool[] = [
  {
    name: "rechercher_jurisprudence_administrative",
    description:
      "Recherche dans la jurisprudence administrative publiée sur Légifrance (Conseil d'État, cours administratives d'appel, jugements de tribunaux administratifs sélectionnés). Mots-clés juridiques précis, sans aucune donnée personnelle du client. Renvoie identifiants, titres (juridiction, date, numéro) et extraits.",
    input_schema: { type: "object", properties: { requete: { type: "string", description: "Mots-clés, par exemple « menace ordre public ancienneté faits refus renouvellement titre séjour »" } }, required: ["requete"] },
  },
  {
    name: "lire_decision_administrative",
    description: "Lit une décision administrative trouvée (identifiant CETATEXT…) : sommaire et motifs, pour vérifier son apport avant de la citer.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "verifier_article",
    description: "Renvoie le texte en vigueur d'un article de code (nom exact du code et numéro, ex. « Code de l'entrée et du séjour des étrangers et du droit d'asile », « L435-1 »), pour citer le bon numéro et la bonne rédaction.",
    input_schema: { type: "object", properties: { code: { type: "string" }, numero: { type: "string" } }, required: ["code", "numero"] },
  },
  {
    name: "rechercher_jurisprudence_judiciaire",
    description: "Recherche dans la jurisprudence judiciaire (Judilibre : Cour de cassation, cours d'appel). Utile seulement pour la rétention, le juge des libertés et de la détention, la nationalité ou l'état civil.",
    input_schema: { type: "object", properties: { requete: { type: "string" } }, required: ["requete"] },
  },
  {
    name: "lire_decision_judiciaire",
    description: "Lit une décision judiciaire trouvée par son identifiant Judilibre.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

export const CONSIGNE_RECHERCHE = [
  "Tu es documentaliste juridique d'un cabinet d'avocats en droit des étrangers. Avant la rédaction d'un acte, tu recherches la jurisprudence pertinente et tu vérifies les textes, avec les outils fournis.",
  "Méthode : identifie les moyens que le dossier soutient (motifs de la décision, situation du client) ; pour chacun, lance des recherches ciblées dans la jurisprudence administrative, de préférence récente (Conseil d'État, puis cours administratives d'appel), lis les décisions prometteuses pour vérifier leur apport, et vérifie le texte en vigueur des articles à citer. Cherche aussi, avec rechercher_decisions_ta_caa, des décisions récentes du tribunal administratif compétent et de sa cour administrative d'appel qui ont fait droit à des moyens comparables ; lis-les avant de les retenir. Douze appels d'outils au plus.",
  "N'envoie aucune donnée personnelle du client dans les requêtes : uniquement des notions juridiques.",
  "Termine par une NOTE DE RECHERCHE : pour chaque moyen, les décisions retenues avec leur référence exacte telle que renvoyée par l'outil (juridiction, formation, date, numéro), leur solution et leur apport en une ou deux phrases, et la citation utile s'il y en a une ; puis les articles vérifiés avec leur rédaction en vigueur et toute renumérotation constatée. N'y mets rien que les outils n'aient renvoyé.",
].join(" ");

/** Exécute un appel d'outil de recherche ; renvoie un texte pour l'IA et, le cas échéant, la décision consultée. */
export async function executerOutil(nom: string, entree: Record<string, string>): Promise<{ texte: string; source?: { titre: string; lien: string } }> {
  try {
    switch (nom) {
      case "rechercher_jurisprudence_administrative": {
        const r = await rechercherAdministrative(entree.requete ?? "");
        return { texte: r.length ? r.map((x) => `[${x.id}] ${x.titre}\n${x.extraits.join(" … ")}`).join("\n\n") : "Aucun résultat : reformule avec d'autres mots-clés." };
      }
      case "lire_decision_administrative": {
        const r = await lireDecisionAdministrative(entree.id ?? "");
        return { texte: `${r.titre}\n\n${r.texte}`, source: { titre: r.titre, lien: r.lien } };
      }
      case "verifier_article": {
        const r = await lireArticle(entree.code ?? "", entree.numero ?? "");
        return r ? { texte: `${r.titre}\n${r.texte}`, source: { titre: r.titre, lien: r.lien } } : { texte: "Article introuvable dans ce code à la date du jour : vérifie le nom exact du code et le numéro (il a pu être renuméroté)." };
      }
      case "rechercher_decisions_ta_caa": {
        const r = await rechercherOpenData(entree.requete ?? "", entree.juridiction);
        return { texte: r.length ? r.map((x) => `[${x.id}] ${x.titre}${x.extraits.length ? `\n${x.extraits.join(" … ")}` : ""}`).join("\n\n") : "Aucun résultat : vérifie la syntaxe (« + » et guillemets) ou élargis la recherche." };
      }
      case "lire_decision_ta_caa": {
        const r = await lireDecisionOpenData(entree.id ?? "");
        return { texte: `${r.titre}\n\n${r.texte}`, source: { titre: r.titre, lien: r.lien } };
      }
      case "rechercher_jurisprudence_judiciaire": {
        const r = await rechercherJudiciaire(entree.requete ?? "");
        return { texte: r.length ? r.map((x) => `[${x.id}] ${x.titre}\n${x.extraits.join(" … ")}`).join("\n\n") : "Aucun résultat." };
      }
      case "lire_decision_judiciaire": {
        const r = await lireDecisionJudiciaire(entree.id ?? "");
        return { texte: `${r.titre}\n\n${r.texte}`, source: { titre: r.titre, lien: r.lien } };
      }
      default:
        return { texte: "Outil inconnu." };
    }
  } catch (e) {
    return { texte: `L'outil n'a pas pu répondre (${String(e instanceof Error ? e.message : e).slice(0, 160)}). Continue avec les autres résultats.` };
  }
}

/** Recherche menée par l'IA avant la rédaction : renvoie la note de recherche et les décisions et articles consultés. */
export async function rechercherPourActe(
  client: Anthropic,
  modele: string,
  contexte: string,
): Promise<{ note: string; sources: { titre: string; lien: string }[]; appels: number } | null> {
  // L'open data de la juridiction administrative ne demande aucune clé : la recherche a lieu même sans PISTE.
  const outilsDispo = (await pisteConfiguree()) ? [...OUTILS_RECHERCHE, ...OUTILS_OPENDATA] : OUTILS_OPENDATA;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: contexte }];
  const sources: { titre: string; lien: string }[] = [];
  let appels = 0;
  for (let tour = 0; tour < 14; tour++) {
    const rep = await client.messages.create({ model: modele, max_tokens: 4000, system: CONSIGNE_RECHERCHE, tools: outilsDispo, messages });
    const outils = rep.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!outils.length || appels >= 12) {
      const note = rep.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
      return note ? { note, sources, appels } : null;
    }
    messages.push({ role: "assistant", content: rep.content });
    const resultats: Anthropic.ToolResultBlockParam[] = [];
    for (const o of outils) {
      appels++;
      const r = await executerOutil(o.name, (o.input ?? {}) as Record<string, string>);
      if (r.source && !sources.some((s) => s.lien === r.source!.lien)) sources.push(r.source);
      resultats.push({ type: "tool_result", tool_use_id: o.id, content: r.texte.slice(0, 12_000) });
    }
    const contenu: (Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam)[] = [...resultats];
    if (appels >= 12) contenu.push({ type: "text", text: "Nombre maximal de recherches atteint : rédige maintenant la NOTE DE RECHERCHE." });
    messages.push({ role: "user", content: contenu });
  }
  return null;
}
