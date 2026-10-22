// Lot 3, étape 2 : agenda du cabinet, questions des clients, consultations (avis et diagnostics écrits).
// Règles : rappels à l'avocat la veille et le jour de chaque échéance (e-mail interne, sans contenu du dossier) ;
// avis à rendre sous 48 heures ouvrées après le paiement ; aucun avis transmis sans attestation de l'avocat ;
// la réponse proposée par l'assistant n'est jamais envoyée sans validation de l'avocat.

import Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, gte, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import type { Base } from "@/db";
import { clients, dossiers, echeances, indisponibilites, messages, paiements, utilisateurs } from "@/db/schema";
import { ajouterHeuresOuvrees, instantParis } from "@/lib/calendrier";
import { journaliser } from "@/lib/journal";
import { procedureLibelle } from "@/lib/modeles";
import { minimiser } from "@/lib/triage";
import { valeur } from "./connexions";
import { voitTout, type Dossier } from "./dossiers";
import { envoyer } from "./notifications";
import { attestationValide, dernierActe } from "./poste";
import type { Membre } from "./session";

const ORIGINE = () => process.env.URL_PUBLIQUE ?? "https://lexpatria.fr";
export type Resultat = { ok: true } | { ok: false; erreur: string };
const refus = (erreur: string): Resultat => ({ ok: false, erreur });

/** Jour civil à Paris, au format AAAA-MM-JJ. */
export function jourParis(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
const plusJours = (j: string, n: number) => {
  const x = new Date(`${j}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

export const LIBELLES_ECHEANCE: Record<string, string> = {
  DATE_LIMITE: "Date limite du recours",
  MEMOIRE_COMPLEMENTAIRE: "Mémoire complémentaire",
  AUDIENCE: "Audience",
  CLOTURE: "Clôture de l'instruction",
  APPEL: "Date limite d'appel",
  REPONSE_MOTIFS: "Réponse de l'administration",
};

const portee = (m: Membre) => (voitTout(m) ? sql`true` : sql`${dossiers.avocatId} = ${m.id}`);
const estConsultation = or(eq(dossiers.avisPrealable, true), eq(dossiers.procedure, "DIAGNOSTIC"));
const TERMINES = ["CLOS", "CLOS_REMBOURSE", "PRE_DOSSIER"] as const;

// ---------- Consultations ----------

/** Échéance de l'avis : 48 heures ouvrées après le premier paiement réglé. */
export function echeanceAvis(payeLe: Date): Date {
  const h = ajouterHeuresOuvrees(payeLe, 48);
  return instantParis(h.jour, h.minutes);
}

export type OngletConsultations = "a_rendre" | "transmis" | "toutes";

export async function consultations(d: Base, m: Membre, onglet: OngletConsultations = "a_rendre") {
  const filtre =
    onglet === "a_rendre"
      ? and(sql`${dossiers.avisTransmisLe} is null`, notInArray(dossiers.statut, [...TERMINES]))
      : onglet === "transmis"
        ? sql`${dossiers.avisTransmisLe} is not null`
        : ne(dossiers.statut, "PRE_DOSSIER");
  const lignes = await d
    .select({
      dos: dossiers,
      cli: { prenom: clients.prenom, nom: clients.nom },
      avocat: { prenom: utilisateurs.prenom, nom: utilisateurs.nom },
      payeLe: sql<Date | null>`(select min(${paiements.creeLe}) from ${paiements} where ${paiements.dossierId} = ${dossiers.id} and ${paiements.statut} = 'PAYE')`,
    })
    .from(dossiers)
    .innerJoin(clients, eq(clients.id, dossiers.clientId))
    .leftJoin(utilisateurs, eq(utilisateurs.id, dossiers.avocatId))
    .where(and(estConsultation, filtre, portee(m)))
    .orderBy(desc(dossiers.creeLe))
    .limit(200);
  const res = [];
  for (const l of lignes) {
    const payeLe = l.payeLe ? new Date(l.payeLe) : null;
    const acte = await dernierActe(d, l.dos.id);
    const avisPret = acte?.type === "AVIS_ECRIT" && !!(await attestationValide(d, acte));
    res.push({ ...l, payeLe, rendreAvant: payeLe ? echeanceAvis(payeLe) : null, avisPret, aUnProjet: acte?.type === "AVIS_ECRIT" });
  }
  // À rendre : les plus pressés d'abord.
  if (onglet === "a_rendre") res.sort((a, b) => (a.rendreAvant?.getTime() ?? Infinity) - (b.rendreAvant?.getTime() ?? Infinity));
  return res;
}

export async function compterAvisARendre(d: Base, m: Membre) {
  const [{ n }] = await d
    .select({ n: sql<number>`count(*)` })
    .from(dossiers)
    .where(and(estConsultation, sql`${dossiers.avisTransmisLe} is null`, notInArray(dossiers.statut, [...TERMINES]), portee(m)));
  return Number(n);
}

/** Remise de l'avis écrit au client : la dernière version attestée devient visible dans son espace. */
export async function transmettreAvis(d: Base, m: Membre, dos: Dossier): Promise<Resultat> {
  if (m.role !== "ASSOCIE" && !(m.role === "AVOCAT" && dos.avocatId === m.id)) return refus("Seul l'avocat en charge du dossier transmet l'avis.");
  if (!(dos.avisPrealable || dos.procedure === "DIAGNOSTIC")) return refus("Ce dossier n'est pas une consultation.");
  if (dos.avisTransmisLe) return refus("L'avis a déjà été transmis.");
  const acte = await dernierActe(d, dos.id);
  if (!acte || acte.type !== "AVIS_ECRIT") return refus("Rédigez d'abord l'avis écrit dans le poste de travail.");
  if (!(await attestationValide(d, acte))) return refus("Attestez d'abord la dernière version de l'avis.");
  const le = new Date();
  await d.update(dossiers).set({ avisTransmisLe: le, statut: "CLOS", majLe: le }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "AVIS_TRANSMIS", details: { acteId: acte.id, version: acte.version } });
  const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
  if (cli?.email)
    await envoyer({
      canal: "EMAIL",
      destinataire: cli.email,
      sujet: "Votre avis écrit est disponible — LEXPATRIA",
      texte: `Bonjour,\n\nVotre avocat vous a remis son avis écrit. Il est disponible dans votre espace, rubrique « Documents » : ${ORIGINE()}/espace\n\nLEXPATRIA Avocats`,
    });
  return { ok: true };
}

/** Avis visible par le client : uniquement après transmission, et uniquement la version attestée. */
export async function avisDuClient(d: Base, dos: Dossier) {
  if (!dos.avisTransmisLe) return null;
  const acte = await dernierActe(d, dos.id);
  if (!acte || acte.type !== "AVIS_ECRIT" || !(await attestationValide(d, acte))) return null;
  return { texte: acte.contenu, le: dos.avisTransmisLe };
}

// ---------- Agenda ----------

export interface ElementAgenda {
  cle: string;
  genre: "ECHEANCE" | "ACCEPTATION" | "AVIS";
  jour: string; // AAAA-MM-JJ (Paris)
  heure?: Date;
  libelle: string;
  reference: string;
  procedure: string;
  avocat: string | null;
  echeanceId?: string;
}

export async function agenda(d: Base, m: Membre, maintenant = new Date()) {
  const aujourdhui = jourParis(maintenant);
  const limite = plusJours(aujourdhui, 60);
  const nomAvocat = sql<string | null>`(select ${utilisateurs.prenom} || ' ' || ${utilisateurs.nom} from ${utilisateurs} where ${utilisateurs.id} = ${dossiers.avocatId})`;
  const ech = await d
    .select({ e: echeances, ref: dossiers.reference, procedure: dossiers.procedure, avocat: nomAvocat })
    .from(echeances)
    .innerJoin(dossiers, eq(dossiers.id, echeances.dossierId))
    .where(and(eq(echeances.faite, false), sql`${echeances.date} <= ${limite}`, notInArray(dossiers.statut, [...TERMINES]), portee(m)))
    .orderBy(asc(echeances.date));
  const acc = await d
    .select({ ref: dossiers.reference, procedure: dossiers.procedure, avant: dossiers.acceptationAvant, avocat: nomAvocat })
    .from(dossiers)
    .where(and(eq(dossiers.statut, "PAYE"), sql`${dossiers.acceptationAvant} is not null`, portee(m)));
  const avis = await consultations(d, m, "a_rendre");

  const elements = ([
    ...ech.map((x) => ({
      cle: `e-${x.e.id}`,
      genre: "ECHEANCE" as const,
      jour: x.e.date,
      libelle: LIBELLES_ECHEANCE[x.e.type] ?? x.e.type,
      reference: x.ref,
      procedure: x.procedure,
      avocat: x.avocat,
      echeanceId: x.e.id,
    })),
    ...acc.map((x) => ({
      cle: `a-${x.ref}`,
      genre: "ACCEPTATION" as const,
      jour: jourParis(x.avant!),
      heure: x.avant!,
      libelle: "Acceptation du dossier",
      reference: x.ref,
      procedure: x.procedure,
      avocat: x.avocat,
    })),
    ...avis
      .filter((x) => x.rendreAvant)
      .map((x) => ({
        cle: `v-${x.dos.reference}`,
        genre: "AVIS" as const,
        jour: jourParis(x.rendreAvant!),
        heure: x.rendreAvant!,
        libelle: x.dos.procedure === "DIAGNOSTIC" ? "Diagnostic écrit à rendre" : "Avis écrit à rendre",
        reference: x.dos.reference,
        procedure: x.dos.procedure,
        avocat: x.avocat?.prenom ? `${x.avocat.prenom} ${x.avocat.nom}` : null,
      })),
  ] as ElementAgenda[]).sort((a, b) => a.jour.localeCompare(b.jour) || (a.heure?.getTime() ?? 0) - (b.heure?.getTime() ?? 0));

  const dans7 = plusJours(aujourdhui, 7);
  const enRetard = (e: ElementAgenda) => (e.heure ? e.heure < maintenant : e.jour < aujourdhui);
  return {
    aujourdhui,
    retard: elements.filter(enRetard),
    semaine: elements.filter((e) => !enRetard(e) && e.jour <= dans7),
    plusTard: elements.filter((e) => !enRetard(e) && e.jour > dans7),
  };
}

/** Absences à venir de l'équipe visible (soi-même, ou toute l'équipe pour un associé). */
export async function absencesEquipe(d: Base, m: Membre) {
  return d
    .select({ a: indisponibilites, prenom: utilisateurs.prenom, nom: utilisateurs.nom })
    .from(indisponibilites)
    .innerJoin(utilisateurs, eq(utilisateurs.id, indisponibilites.avocatId))
    .where(and(gte(indisponibilites.fin, new Date()), voitTout(m) ? sql`true` : eq(indisponibilites.avocatId, m.id)))
    .orderBy(asc(indisponibilites.debut));
}

/**
 * Rappels à l'avocat : la veille puis le jour de chaque échéance (tâche planifiée).
 * `rappelLe` garde le jour du dernier rappel, pour n'en envoyer qu'un par jour.
 */
export async function rappelerEcheances(d: Base, maintenant = new Date()) {
  const aujourdhui = jourParis(maintenant);
  const demain = plusJours(aujourdhui, 1);
  const dues = await d
    .select({ e: echeances, ref: dossiers.reference, email: utilisateurs.email })
    .from(echeances)
    .innerJoin(dossiers, eq(dossiers.id, echeances.dossierId))
    .innerJoin(utilisateurs, eq(utilisateurs.id, dossiers.avocatId))
    .where(
      and(
        eq(echeances.faite, false),
        inArray(echeances.date, [aujourdhui, demain]),
        or(sql`${echeances.rappelLe} is null`, ne(echeances.rappelLe, aujourdhui)),
        notInArray(dossiers.statut, [...TERMINES]),
      ),
    );
  for (const x of dues) {
    const quand = x.e.date === aujourdhui ? "aujourd'hui" : "demain";
    await envoyer({
      canal: "EMAIL",
      destinataire: x.email,
      sujet: `Échéance ${quand} — dossier ${x.ref}`,
      texte: `${LIBELLES_ECHEANCE[x.e.type] ?? x.e.type} : ${quand} (${x.e.date.split("-").reverse().join("/")}).\n${ORIGINE()}/avocat/dossiers/${x.ref}`,
    });
    await d.update(echeances).set({ rappelLe: aujourdhui }).where(eq(echeances.id, x.e.id));
  }
  return { rappels: dues.length };
}

// ---------- Questions des clients ----------

/** Dossiers dont le dernier message vient du client : une réponse du cabinet est attendue. */
export async function questionsEnAttente(d: Base, m: Membre) {
  const derniers = await d
    .selectDistinctOn([messages.dossierId], { dossierId: messages.dossierId, auteur: messages.auteur, contenu: messages.contenu, le: messages.creeLe })
    .from(messages)
    .orderBy(messages.dossierId, desc(messages.creeLe));
  const attente = derniers.filter((x) => x.auteur === "CLIENT");
  if (!attente.length) return [];
  const doss = await d
    .select({ dos: dossiers, cli: { prenom: clients.prenom, nom: clients.nom } })
    .from(dossiers)
    .innerJoin(clients, eq(clients.id, dossiers.clientId))
    .where(and(inArray(dossiers.id, attente.map((x) => x.dossierId)), portee(m)));
  return doss
    .map((x) => ({ ...x, dernier: attente.find((a) => a.dossierId === x.dos.id)! }))
    .sort((a, b) => a.dernier.le.getTime() - b.dernier.le.getTime()); // la plus ancienne attente d'abord
}

/** Réponse proposée à l'avocat (jamais envoyée sans sa validation). Données minimisées avant l'IA. */
export async function proposerReponse(d: Base, m: Membre, dos: Dossier): Promise<{ ok: true; texte: string; source: "IA" | "MODELE" } | { ok: false; erreur: string }> {
  const fil = await d.select().from(messages).where(eq(messages.dossierId, dos.id)).orderBy(desc(messages.creeLe)).limit(8);
  if (!fil.length || fil[0].auteur !== "CLIENT") return { ok: false, erreur: "Aucune question en attente dans ce dossier." };
  const [av] = dos.avocatId ? await d.select().from(utilisateurs).where(eq(utilisateurs.id, dos.avocatId)) : [];
  const signature = av ? `Maître ${av.prenom} ${av.nom}` : `Maître ${m.prenom} ${m.nom}`;
  const cle = await valeur("ANTHROPIC_API_KEY");
  let texte = `Bonjour,\n\nNous avons bien reçu votre message. XXX\n\nNous restons à votre disposition pour toute question.\n\nBien à vous,\n\n${signature}`;
  let source: "IA" | "MODELE" = "MODELE";
  if (cle) {
    const echanges = fil
      .slice()
      .reverse()
      .map((x) => `${x.auteur === "CLIENT" ? "CLIENT" : "CABINET"} : ${minimiser(x.contenu)}`)
      .join("\n");
    const rep = await new Anthropic({ apiKey: cle }).messages.create({
      model: (await valeur("ANTHROPIC_MODEL")) ?? "claude-sonnet-4-5",
      max_tokens: 900,
      system:
        "Tu prépares, pour un avocat au barreau de Paris (droit des étrangers), un projet de réponse au message de son client. Ton digne, clair et bienveillant, phrases simples. N'invente aucun fait, aucune date, aucun engagement de résultat ; n'emploie jamais « garanti », « gratuit » ou « 100 % ». Là où une information manque ou relève de l'appréciation de l'avocat, écris « XXX ». Commence par « Bonjour, » et termine par « Bien à vous, » suivi de la signature fournie. Renvoie uniquement le texte du message.",
      messages: [
        {
          role: "user",
          content: `PROCÉDURE : ${procedureLibelle(dos.procedure)}\nÉTAPE : ${dos.statut}\nDATE LIMITE : ${dos.dateLimite ?? "inconnue"}${dos.dateLimiteVerifiee ? " (vérifiée)" : " (non vérifiée)"}\n\nÉCHANGES RÉCENTS (minimisés) :\n${echanges}\n\nSIGNATURE : ${signature}`,
        },
      ],
    });
    const t = rep.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    if (t.length > 20) {
      texte = t;
      source = "IA";
    }
  }
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "REPONSE_PROPOSEE", details: { source } });
  return { ok: true, texte, source };
}
