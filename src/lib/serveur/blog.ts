// Blog « Actualités » : articles d'information en droit des étrangers, pour le référencement.
// Rédaction par un associé, éventuellement à partir d'un brouillon de l'IA ; rien n'est publié sans lui.
// Publication refusée si le texte contient un mot interdit (gratuit, garanti, spécialiste…).

import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { Base } from "@/db";
import { articles } from "@/db/schema";
import { controlerTexte } from "@/lib/deontologie";
import { extraireJson } from "@/lib/ia";
import { journaliser } from "@/lib/journal";
import { PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { valeur } from "./connexions";

export type Article = typeof articles.$inferSelect;

export function slugifier(titre: string): string {
  return titre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const publies = (d: Base) => d.select().from(articles).where(eq(articles.publie, true)).orderBy(desc(articles.publieLe));
export const tous = (d: Base) => d.select().from(articles).orderBy(desc(articles.majLe));
export async function parSlug(d: Base, slug: string, seulementPublie = true): Promise<Article | null> {
  const [a] = await d
    .select()
    .from(articles)
    .where(seulementPublie ? and(eq(articles.slug, slug), eq(articles.publie, true)) : eq(articles.slug, slug));
  return a ?? null;
}

export const SaisieArticle = z.object({
  id: z.string().max(40).optional(),
  titre: z.string().trim().min(5).max(160),
  slug: z.string().trim().max(80).optional(),
  chapo: z.string().trim().max(400),
  contenu: z.string().max(60_000),
  procedure: z.string().max(40).nullable().optional(),
});
type Saisie = z.infer<typeof SaisieArticle>;
type Resultat = { ok: true; article: Article } | { ok: false; erreur: string };

async function slugLibre(d: Base, base: string, id?: string) {
  let s = base || "article";
  for (let n = 2; ; n++) {
    const [x] = await d
      .select({ id: articles.id })
      .from(articles)
      .where(id ? and(eq(articles.slug, s), ne(articles.id, id)) : eq(articles.slug, s));
    if (!x) return s;
    s = `${base}-${n}`;
  }
}

export async function enregistrer(d: Base, auteurId: string, x: Saisie): Promise<Resultat> {
  const procedure = x.procedure && x.procedure in PROCEDURES ? (x.procedure as CodeProcedure) : null;
  const slug = await slugLibre(d, slugifier(x.slug || x.titre), x.id);
  const champs = { titre: x.titre, slug, chapo: x.chapo, contenu: x.contenu, procedure, majLe: new Date() };
  const [a] = x.id
    ? await d.update(articles).set(champs).where(eq(articles.id, x.id)).returning()
    : await d.insert(articles).values({ ...champs, auteurId }).returning();
  if (!a) return { ok: false, erreur: "Article introuvable." };
  // Un article publié reste conforme : la modification est refusée si elle introduit un mot interdit.
  if (a.publie) {
    const inf = controlerTexte(`${a.titre}\n${a.chapo}\n${a.contenu}`);
    if (inf.length) {
      await d.update(articles).set({ publie: false }).where(eq(articles.id, a.id));
      return { ok: false, erreur: `Article dépublié : « ${inf[0].extrait.trim()} » (${inf[0].motif}). Corrigez puis republiez.` };
    }
  }
  await journaliser(d, { acteur: auteurId, action: x.id ? "ARTICLE_MODIFIE" : "ARTICLE_CREE", details: { slug } });
  return { ok: true, article: a };
}

export async function publier(d: Base, auteurId: string, id: string, oui: boolean): Promise<Resultat> {
  const [a] = await d.select().from(articles).where(eq(articles.id, id));
  if (!a) return { ok: false, erreur: "Article introuvable." };
  if (oui) {
    if (a.contenu.trim().length < 300) return { ok: false, erreur: "Article trop court pour être publié (300 caractères au moins)." };
    const inf = controlerTexte(`${a.titre}\n${a.chapo}\n${a.contenu}`);
    if (inf.length) return { ok: false, erreur: `Publication refusée : « ${inf[0].extrait.trim()} » (${inf[0].motif}).` };
  }
  const [maj] = await d
    .update(articles)
    .set({ publie: oui, publieLe: oui ? (a.publieLe ?? new Date()) : a.publieLe, majLe: new Date() })
    .where(eq(articles.id, id))
    .returning();
  await journaliser(d, { acteur: auteurId, action: oui ? "ARTICLE_PUBLIE" : "ARTICLE_DEPUBLIE", details: { slug: a.slug } });
  return { ok: true, article: maj };
}

export async function supprimer(d: Base, auteurId: string, id: string) {
  const [a] = await d.delete(articles).where(eq(articles.id, id)).returning();
  if (a) await journaliser(d, { acteur: auteurId, action: "ARTICLE_SUPPRIME", details: { slug: a.slug } });
  return !!a;
}

const Brouillon = z.object({ titre: z.string(), chapo: z.string(), contenu: z.string(), procedure: z.string().nullable().optional() });

const CONSIGNE = `Tu rédiges des articles d'information pour le blog de LEXPATRIA Avocats, cabinet d'avocats au barreau de Paris, en contentieux du droit des étrangers.
Public : personnes étrangères et leurs proches, souvent inquiètes, qui cherchent une réponse claire sur Internet.
Style : français simple et épuré, phrases courtes, aucune répétition, aucun jargon non expliqué, ton sobre et digne. Pas de superlatifs ni de ton commercial.
Fond : information générale exacte. Cite les textes applicables (CESEDA, code de justice administrative, accord franco-algérien du 27 décembre 1968) seulement quand tu es certain de la référence ; à défaut, écris « XXX » à la place de la référence. Jamais de pronostic, jamais de promesse de résultat.
Interdits absolus : les mots « gratuit », « offert », « sans frais », « garanti », « 100 % », « spécialiste », « avocats du barreau » ; aucune mention de l'aide juridictionnelle comme possible chez nous ; aucun numéro de téléphone.
Forme : 700 à 1 100 mots. Le contenu utilise « ## » pour les intertitres (3 à 5), « - » pour les listes, **gras** avec parcimonie. Pas de titre de niveau 1 dans le contenu. Termine par une courte section « ## En pratique » qui dit quoi faire et dans quel délai, sans appel commercial (le site ajoute lui-même l'invitation à agir).
Le titre (60 à 70 caractères) reprend la question que se pose le lecteur. Le chapô (une ou deux phrases, 160 caractères au plus) résume la réponse.
"procedure" : le code de la procédure la plus liée parmi ${Object.keys(PROCEDURES).join(", ")}, ou null.
Réponds UNIQUEMENT par un objet JSON {"titre","chapo","contenu","procedure"}.`;

/** Brouillon rédigé par l'IA sur un sujet donné ; enregistré non publié, à relire par l'associé. */
export async function rediger(d: Base, auteurId: string, sujet: string): Promise<Resultat> {
  const cle = await valeur("ANTHROPIC_API_KEY");
  if (!cle) return { ok: false, erreur: "La clé Anthropic n'est pas configurée (Back office › Connexions)." };
  try {
    const rep = await new Anthropic({ apiKey: cle }).messages.create({
      model: (await valeur("ANTHROPIC_MODEL")) ?? "claude-sonnet-5",
      max_tokens: 4000,
      system: CONSIGNE,
      messages: [{ role: "user", content: `Sujet de l'article : ${sujet}` }],
    });
    const b = Brouillon.parse(extraireJson(rep.content));
    return enregistrer(d, auteurId, { titre: b.titre.slice(0, 160), chapo: b.chapo.slice(0, 400), contenu: b.contenu, procedure: b.procedure ?? null });
  } catch (e) {
    console.error("Rédaction d'article impossible :", e instanceof Error ? e.message.slice(0, 300) : e);
    return { ok: false, erreur: "La rédaction a échoué. Réessayez dans un instant." };
  }
}
