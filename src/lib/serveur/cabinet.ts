// Actions de l'espace cabinet (lot 3). Chaque action vérifie les droits et s'inscrit au journal du dossier.

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Base } from "@/db";
import { clients, dossiers, echeances, indisponibilites, journal, messages, pieces, utilisateurs } from "@/db/schema";
import { journaliser } from "@/lib/journal";
import { STATUTS_AVOCAT, type Statut } from "@/lib/statuts";
import { ajouterMessage, voitTout, type Dossier } from "./dossiers";
import { envoyer } from "./notifications";
import { attestationValide, dernierActe } from "./poste";
import type { Membre } from "./session";

const ORIGINE = () => process.env.URL_PUBLIQUE ?? "https://lexpatria.fr";

export type Resultat = { ok: true } | { ok: false; erreur: string };
const refus = (erreur: string): Resultat => ({ ok: false, erreur });

async function prevenirClient(d: Base, dos: Dossier, sujet: string, phrase: string) {
  const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
  if (!cli?.email) return;
  await envoyer({
    canal: "EMAIL",
    destinataire: cli.email,
    sujet,
    texte: `Bonjour,\n\n${phrase}\nRetrouvez le détail dans votre espace : ${ORIGINE()}/espace\n\nLEXPATRIA Avocats`,
  });
}

export async function accepter(d: Base, m: Membre, dos: Dossier): Promise<Resultat> {
  if (dos.statut !== "PAYE") return refus("Ce dossier n'est plus en attente d'acceptation.");
  if (m.role !== "ASSOCIE" && dos.avocatId !== m.id) return refus("Ce dossier est attribué à un autre avocat.");
  if (m.role !== "ASSOCIE" && m.role !== "AVOCAT") return refus("Seul un avocat peut accepter un dossier.");
  const maintenant = new Date();
  await d.update(dossiers).set({ statut: "PRIS_EN_CHARGE", avocatId: dos.avocatId ?? m.id, accepteLe: maintenant, majLe: maintenant }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "DOSSIER_ACCEPTE" });
  const [av] = await d.select().from(utilisateurs).where(eq(utilisateurs.id, dos.avocatId ?? m.id));
  await prevenirClient(d, dos, "Votre dossier est pris en charge — LEXPATRIA", `Maître ${av.prenom} ${av.nom} a pris en charge votre dossier ${dos.reference}.`);
  return { ok: true };
}

export async function changerStatut(d: Base, m: Membre, dos: Dossier, statut: string): Promise<Resultat> {
  if (!STATUTS_AVOCAT.includes(statut as Statut)) return refus("Étape inconnue.");
  if (m.role === "SECRETARIAT" && !["DEPOSE", "ENREGISTRE", "INSTRUCTION", "AUDIENCE", "JUGE"].includes(statut)) return refus("Étape réservée à l'avocat.");
  if (dos.statut === "PAYE" && statut !== "PRIS_EN_CHARGE") return refus("Acceptez d'abord le dossier.");
  if (statut === "DEPOSE" && !dos.dateLimiteVerifiee) return refus("Vérifiez et fixez d'abord la date limite du recours.");
  if (statut === "DEPOSE" && !(await attestationValide(d, await dernierActe(d, dos.id))))
    return refus("Aucun dépôt sans attestation de l'avocat sur la dernière version de l'acte.");
  if (statut === "PRIS_EN_CHARGE" && dos.statut === "PAYE") return accepter(d, m, dos);
  await d.update(dossiers).set({ statut: statut as Statut, majLe: new Date() }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "STATUT_MODIFIE", details: { de: dos.statut, vers: statut } });
  if (["DEPOSE", "ENREGISTRE", "AUDIENCE", "JUGE", "CLOS"].includes(statut))
    await prevenirClient(d, dos, "Votre dossier avance — LEXPATRIA", `Votre dossier ${dos.reference} a franchi une nouvelle étape.`);
  return { ok: true };
}

/** L'avocat vérifie la date limite : elle devient la date de référence et une échéance est créée. */
export async function fixerDateLimite(d: Base, m: Membre, dos: Dossier, date: string): Promise<Resultat> {
  if (m.role !== "ASSOCIE" && m.role !== "AVOCAT") return refus("Seul un avocat fixe la date limite.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return refus("Date invalide.");
  await d.update(dossiers).set({ dateLimite: date, dateLimiteVerifiee: true, majLe: new Date() }).where(eq(dossiers.id, dos.id));
  await d.delete(echeances).where(and(eq(echeances.dossierId, dos.id), eq(echeances.type, "DATE_LIMITE")));
  await d.insert(echeances).values({ dossierId: dos.id, type: "DATE_LIMITE", date });
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "DATE_LIMITE_VERIFIEE", details: { estimee: dos.dateLimite, retenue: date } });
  return { ok: true };
}

export const TYPES_ECHEANCE = ["MEMOIRE_COMPLEMENTAIRE", "AUDIENCE", "CLOTURE", "APPEL", "REPONSE_MOTIFS"] as const;

export async function ajouterEcheance(d: Base, m: Membre, dos: Dossier, type: string, date: string): Promise<Resultat> {
  if (!(TYPES_ECHEANCE as readonly string[]).includes(type)) return refus("Type d'échéance inconnu.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return refus("Date invalide.");
  await d.insert(echeances).values({ dossierId: dos.id, type, date });
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "ECHEANCE_AJOUTEE", details: { type, date } });
  return { ok: true };
}

export async function echeanceFaite(d: Base, m: Membre, dos: Dossier, id: string): Promise<Resultat> {
  await d.update(echeances).set({ faite: true }).where(and(eq(echeances.id, id), eq(echeances.dossierId, dos.id)));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "ECHEANCE_FAITE", details: { id } });
  return { ok: true };
}

/** Demande une pièce au client : la pièce apparaît « à transmettre » dans son espace, avec un message. */
export async function demanderPiece(d: Base, m: Membre, dos: Dossier, libelle: string): Promise<Resultat> {
  const l = libelle.trim().slice(0, 200);
  if (l.length < 3) return refus("Précisez la pièce demandée.");
  await d.insert(pieces).values({ dossierId: dos.id, type: "DEMANDEE", libelle: l, manquante: true });
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "PIECE_DEMANDEE", details: { libelle: l } });
  await ajouterMessage(d, dos, m.role === "SECRETARIAT" ? "SECRETARIAT" : "AVOCAT", m.id, `Merci de transmettre la pièce suivante depuis la rubrique « Pièces » : ${l}.`);
  return { ok: true };
}

export async function verifierPiece(d: Base, m: Membre, dos: Dossier, pieceId: string): Promise<Resultat> {
  await d.update(pieces).set({ verifiee: true }).where(and(eq(pieces.id, pieceId), eq(pieces.dossierId, dos.id)));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "PIECE_VERIFIEE", details: { pieceId } });
  return { ok: true };
}

export async function reattribuer(d: Base, m: Membre, dos: Dossier, avocatId: string): Promise<Resultat> {
  if (m.role !== "ASSOCIE") return refus("Réservé aux associés.");
  const [av] = await d.select().from(utilisateurs).where(and(eq(utilisateurs.id, avocatId), eq(utilisateurs.actif, true)));
  if (!av || (av.role !== "AVOCAT" && av.role !== "ASSOCIE")) return refus("Avocat introuvable.");
  await d.update(dossiers).set({ avocatId, majLe: new Date() }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "DOSSIER_REATTRIBUE", details: { de: dos.avocatId, vers: avocatId } });
  await envoyer({
    canal: "EMAIL",
    destinataire: av.email,
    sujet: `Dossier ${dos.reference} attribué`,
    texte: `Le dossier ${dos.reference} vous a été attribué.\n${ORIGINE()}/avocat/dossiers/${dos.reference}`,
  });
  return { ok: true };
}

// ---------- Ma journée ----------

export async function journee(d: Base, m: Membre) {
  const tous = voitTout(m);
  const mesDossiers = tous ? sql`true` : sql`${dossiers.avocatId} = ${m.id}`;
  const aAccepter = await d
    .select({ dos: dossiers, cli: { prenom: clients.prenom, nom: clients.nom } })
    .from(dossiers)
    .innerJoin(clients, eq(clients.id, dossiers.clientId))
    .where(and(eq(dossiers.statut, "PAYE"), mesDossiers))
    .orderBy(dossiers.acceptationAvant);
  const dans14 = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const prochaines = await d
    .select({ e: echeances, ref: dossiers.reference, procedure: dossiers.procedure })
    .from(echeances)
    .innerJoin(dossiers, eq(dossiers.id, echeances.dossierId))
    .where(and(eq(echeances.faite, false), sql`${echeances.date} <= ${dans14}`, mesDossiers))
    .orderBy(echeances.date)
    .limit(30);
  const nonVerifiees = await d
    .select({ ref: dossiers.reference, dateLimite: dossiers.dateLimite, procedure: dossiers.procedure })
    .from(dossiers)
    .where(and(inArray(dossiers.statut, ["PRIS_EN_CHARGE", "EN_REDACTION"]), eq(dossiers.dateLimiteVerifiee, false), mesDossiers))
    .orderBy(dossiers.dateLimite)
    .limit(30);
  const messagesClients = await d
    .select({ ref: dossiers.reference, n: sql<number>`count(*)` })
    .from(messages)
    .innerJoin(dossiers, eq(dossiers.id, messages.dossierId))
    .where(and(eq(messages.auteur, "CLIENT"), sql`${messages.luLe} is null`, mesDossiers))
    .groupBy(dossiers.reference);
  return { aAccepter, prochaines, nonVerifiees, messagesClients, aujourdhui };
}

// ---------- Disponibilités ----------

export async function disponibilites(d: Base, avocatId: string) {
  return d
    .select()
    .from(indisponibilites)
    .where(and(eq(indisponibilites.avocatId, avocatId), gte(indisponibilites.fin, new Date())))
    .orderBy(indisponibilites.debut);
}

export async function ajouterIndisponibilite(d: Base, par: string, avocatId: string, debut: string, fin: string): Promise<Resultat> {
  const a = new Date(`${debut}T00:00:00`);
  const b = new Date(`${fin}T23:59:59`);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return refus("Période invalide.");
  await d.insert(indisponibilites).values({ avocatId, debut: a, fin: b });
  await journaliser(d, { acteur: par, action: "INDISPONIBILITE_AJOUTEE", details: { avocatId, debut, fin } });
  return { ok: true };
}

export async function supprimerIndisponibilite(d: Base, m: Membre, id: string): Promise<Resultat> {
  const cond = m.role === "ASSOCIE" ? eq(indisponibilites.id, id) : and(eq(indisponibilites.id, id), eq(indisponibilites.avocatId, m.id));
  await d.delete(indisponibilites).where(cond);
  await journaliser(d, { acteur: m.id, action: "INDISPONIBILITE_SUPPRIMEE", details: { id } });
  return { ok: true };
}

export async function basculerAttribution(d: Base, par: string, avocatId: string, ouverte: boolean): Promise<Resultat> {
  await d.update(utilisateurs).set({ attributionOuverte: ouverte }).where(eq(utilisateurs.id, avocatId));
  await journaliser(d, { acteur: par, action: ouverte ? "ATTRIBUTION_OUVERTE" : "ATTRIBUTION_FERMEE", details: { avocatId } });
  return { ok: true };
}

export async function equipe(d: Base) {
  return d.select().from(utilisateurs).orderBy(utilisateurs.role, utilisateurs.nom);
}

export async function journalDossier(d: Base, dossierId: string) {
  return d.select().from(journal).where(eq(journal.dossierId, dossierId)).orderBy(desc(journal.le)).limit(40);
}
