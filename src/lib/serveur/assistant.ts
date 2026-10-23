// Assistant du back office (niveau 1) : un associé décrit une modification en français ;
// l'assistant prépare une proposition (avant / après), contrôlée par le filtre déontologique.
// Rien n'est appliqué sans la validation d'un associé. Aucune donnée de client n'est transmise au modèle :
// seuls les paramètres du site et la liste de l'équipe lui sont communiqués.
// Une demande qui exige de modifier le code (nouvel écran, nouvelle procédure) est classée « évolution »
// et relève de l'agent de développement (niveau 2 : dépôt GitHub, version d'essai, mise en ligne validée).

import { extraireJson } from "@/lib/ia";
import Anthropic from "@anthropic-ai/sdk";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Base } from "@/db";
import { propositions, utilisateurs } from "@/db/schema";
import { journaliser } from "@/lib/journal";
import { CLES_PARAMETRES, LIBELLES_DILIGENCE, PARAMETRES, type CleParametre } from "@/lib/parametres";
import { ajouterIndisponibilite, basculerAttribution } from "./cabinet";
import { valeur } from "./connexions";
import { controler, ecrireParametre, lireParametre } from "./parametres";

const Changement = z.discriminatedUnion("type", [
  z.object({ type: z.literal("parametre"), cle: z.string(), valeur: z.unknown() }),
  z.object({ type: z.literal("indisponibilite"), avocatId: z.string(), debut: z.string(), fin: z.string() }),
  z.object({ type: z.literal("attribution"), avocatId: z.string(), ouverte: z.boolean() }),
]);
const Reponse = z.object({
  resume: z.string(),
  changements: z.array(Changement).default([]),
  evolution: z.string().nullable().optional(), // demande qui exige de modifier le code
  question: z.string().nullable().optional(), // précision nécessaire avant de proposer
});
export type ChangementPropose = z.infer<typeof Changement> & { avant?: unknown; libelle?: string };

const CONSIGNE = `Tu es l'assistant du back office de LEXPATRIA Avocats (avocats au barreau de Paris, droit des étrangers).
Un associé du cabinet te demande de modifier un contenu ou un réglage du site. Tu prépares une proposition ; l'associé la validera.

Règles :
- Tu ne peux modifier que les paramètres listés, les absences des avocats et l'ouverture de leur attribution.
- Pour un paramètre, renvoie sa NOUVELLE valeur COMPLÈTE (même format JSON que la valeur actuelle), en ne changeant que ce qui est demandé.
- Montants des tarifs en centimes TTC (990 € = 99000).
- Dates au format AAAA-MM-JJ. Utilise la date du jour fournie pour interpréter « lundi prochain », etc.
- Ton déontologique : jamais « gratuit », « offert », « sans frais », « garanti », « 100 % », « spécialiste », « avocats du barreau » (dire « avocats au barreau de Paris »), « jours ouvrables » (dire « heures ouvrées » ou « jours ouvrés »). Pas de promesse de résultat.
- Si la demande exige de modifier le code du site (nouvel écran, nouvelle fonctionnalité, mise en page, nouvelle procédure), ne propose aucun changement : remplis "evolution" avec la demande reformulée pour le développeur.
- Si la demande est ambiguë, ne propose rien et pose une seule "question".
Réponds UNIQUEMENT par un objet JSON : {"resume": "...", "changements": [...], "evolution": null, "question": null}
Formats de changement : {"type":"parametre","cle":"…","valeur":…} | {"type":"indisponibilite","avocatId":"…","debut":"AAAA-MM-JJ","fin":"AAAA-MM-JJ"} | {"type":"attribution","avocatId":"…","ouverte":true|false}`;

async function contexte(d: Base) {
  const params: Record<string, unknown> = {};
  for (const cle of CLES_PARAMETRES) {
    params[cle] = { libelle: PARAMETRES[cle].libelle, aide: PARAMETRES[cle].aide, valeur: await lireParametre(d, cle) };
  }
  const equipe = await d
    .select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, role: utilisateurs.role, attributionOuverte: utilisateurs.attributionOuverte })
    .from(utilisateurs)
    .where(eq(utilisateurs.actif, true));
  return { aujourdhui: new Date().toISOString().slice(0, 10), parametres: params, equipe };
}

/** Sans clé Anthropic (essais) : compréhension simple de quelques demandes de prix et d'absence. */
async function simuler(d: Base, demande: string): Promise<z.infer<typeof Reponse>> {
  const t = demande.toLowerCase();
  const prix = t.match(/(\d[\d\s]*)\s*(€|euros?)/);
  const tarifs = await lireParametre(d, "tarifs");
  const cibles: [RegExp, keyof typeof tarifs][] = [
    [/oqtf|requ[êe]te|titre/, "REQUETE"],
    [/rapo|visa|naturalisation/, "RAPO"],
    [/urgence/, "MAJORATION_URGENCE"],
    [/diagnostic/, "DIAGNOSTIC"],
    [/appel/, "APPEL"],
    [/mise en demeure/, "MISE_EN_DEMEURE"],
  ];
  if (prix) {
    const cible = cibles.find(([re]) => re.test(t))?.[1];
    if (cible) {
      const montant = Number(prix[1].replace(/\s/g, "")) * 100;
      return { resume: `${LIBELLES_DILIGENCE[cible]} : ${(montant / 100).toLocaleString("fr-FR")} €.`, changements: [{ type: "parametre", cle: "tarifs", valeur: { ...tarifs, [cible]: montant } }] };
    }
  }
  const dates = [...t.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]);
  if (/absent|absence|cong[ée]/.test(t) && dates.length >= 1) {
    const equipe = await d.select().from(utilisateurs);
    const av = equipe.find((u) => t.includes(u.nom.toLowerCase()));
    if (av) return { resume: `Absence de Me ${av.prenom} ${av.nom}.`, changements: [{ type: "indisponibilite", avocatId: av.id, debut: dates[0], fin: dates[1] ?? dates[0] }] };
  }
  if (/(page|[ée]cran|bouton|fonction|proc[ée]dure nouvelle|mise en page|couleur)/.test(t)) {
    return { resume: "Évolution du site.", changements: [], evolution: demande };
  }
  return { resume: "", changements: [], question: "Précisez la modification (prix, texte de la FAQ, titre de l'accueil, absence d'un avocat…)." };
}

async function interroger(d: Base, demande: string) {
  const cle = await valeur("ANTHROPIC_API_KEY");
  if (!cle) return simuler(d, demande);
  const client = new Anthropic({ apiKey: cle });
  const rep = await client.messages.create({
    model: (await valeur("ANTHROPIC_MODEL")) ?? "claude-sonnet-5",
    max_tokens: 4000,
    system: CONSIGNE,
    messages: [
      { role: "user", content: `Contexte (JSON) :\n${JSON.stringify(await contexte(d))}\n\nDemande de l'associé :\n${demande}` },
    ],
  });
  return Reponse.parse(extraireJson(rep.content));
}

export async function proposer(d: Base, auteurId: string, demande: string) {
  const r = await interroger(d, demande.slice(0, 3000));
  const equipe = await d.select().from(utilisateurs);
  const alertes: string[] = [];
  const changements: ChangementPropose[] = [];
  for (const c of r.changements) {
    if (c.type === "parametre") {
      if (!(CLES_PARAMETRES as string[]).includes(c.cle)) {
        alertes.push(`Paramètre inconnu ignoré : ${c.cle}`);
        continue;
      }
      const ctl = controler(c.cle, c.valeur);
      alertes.push(...ctl.erreurs, ...ctl.infractions.map((i) => `Terme interdit « ${i.motif} » : …${i.extrait}…`));
      changements.push({ ...c, valeur: ctl.valeur ?? c.valeur, avant: await lireParametre(d, c.cle as CleParametre), libelle: PARAMETRES[c.cle as CleParametre].libelle });
    } else {
      const av = equipe.find((u) => u.id === c.avocatId);
      if (!av) {
        alertes.push("Avocat introuvable dans l'équipe.");
        continue;
      }
      changements.push({
        ...c,
        libelle: c.type === "indisponibilite" ? `Absence de Me ${av.prenom} ${av.nom}` : `Attribution des dossiers à Me ${av.prenom} ${av.nom}`,
        avant: c.type === "attribution" ? av.attributionOuverte : null,
      });
    }
  }
  const statut = r.evolution ? "EVOLUTION" : r.question || !changements.length ? "QUESTION" : "PROPOSEE";
  const [p] = await d
    .insert(propositions)
    .values({
      auteurId,
      demande,
      resume: r.evolution ? `Évolution du site : ${r.evolution}` : r.question ? r.question : r.resume,
      changements,
      alertes,
      statut,
    })
    .returning();
  await journaliser(d, { acteur: auteurId, action: "ASSISTANT_PROPOSITION", details: { propositionId: p.id, statut } });
  return p;
}

export async function decider(d: Base, associeId: string, propositionId: string, valider: boolean): Promise<{ ok: boolean; erreur?: string }> {
  const [p] = await d.select().from(propositions).where(eq(propositions.id, propositionId));
  if (!p || p.statut !== "PROPOSEE") return { ok: false, erreur: "Proposition introuvable ou déjà traitée." };
  if (!valider) {
    await d.update(propositions).set({ statut: "REJETEE", traiteePar: associeId, traiteeLe: new Date() }).where(eq(propositions.id, p.id));
    await journaliser(d, { acteur: associeId, action: "ASSISTANT_REJET", details: { propositionId: p.id } });
    return { ok: true };
  }
  if ((p.alertes as string[]).length) return { ok: false, erreur: "La proposition comporte des alertes : corrigez la demande." };
  const erreurs: string[] = [];
  for (const c of p.changements as ChangementPropose[]) {
    if (c.type === "parametre") {
      const r = await ecrireParametre(d, c.cle as CleParametre, c.valeur, associeId, { origine: "ASSISTANT", motif: p.demande.slice(0, 300) });
      if (!r.ok) erreurs.push(...r.erreurs, ...r.infractions.map((i) => i.motif));
    } else if (c.type === "indisponibilite") {
      const r = await ajouterIndisponibilite(d, associeId, c.avocatId, c.debut, c.fin);
      if (!r.ok) erreurs.push(r.erreur);
    } else {
      await basculerAttribution(d, associeId, c.avocatId, c.ouverte);
    }
  }
  await d
    .update(propositions)
    .set({ statut: erreurs.length ? "ECHEC" : "APPLIQUEE", traiteePar: associeId, traiteeLe: new Date(), alertes: erreurs })
    .where(eq(propositions.id, p.id));
  await journaliser(d, { acteur: associeId, action: "ASSISTANT_VALIDATION", details: { propositionId: p.id, erreurs } });
  return erreurs.length ? { ok: false, erreur: erreurs.join(" ; ") } : { ok: true };
}

export async function dernieresPropositions(d: Base, limite = 20) {
  return d.select().from(propositions).orderBy(desc(propositions.creeLe)).limit(limite);
}
