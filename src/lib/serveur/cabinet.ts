// Actions de l'espace cabinet (lot 3). Chaque action vérifie les droits et s'inscrit au journal du dossier.

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Base } from "@/db";
import { clients, dossiers, echeances, indisponibilites, journal, messages, pieces, utilisateurs } from "@/db/schema";
import { journaliser } from "@/lib/journal";
import { casDuTriage, trouverCas } from "@/lib/cas";
import { lireParametre } from "./parametres";
import { genre, libelleClient, rang as rangStatut, STATUTS_AVOCAT, type Statut } from "@/lib/statuts";
import { attestationsClient } from "@/lib/attestations";
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
  await prevenirClient(d, dos, "Votre dossier est pris en charge — LEXPATRIA", `Maître ${av.prenom} ${av.nom} a pris en charge votre dossier ${dos.reference}.${libelleClient("PRIS_EN_CHARGE", dos.procedure, dos.avisPrealable).includes("attestation") ? " Votre attestation est disponible dans votre espace." : ""}`);
  return { ok: true };
}

export async function changerStatut(d: Base, m: Membre, dos: Dossier, statut: string): Promise<Resultat> {
  if (!STATUTS_AVOCAT.includes(statut as Statut)) return refus("Étape inconnue.");
  if (m.role === "SECRETARIAT" && !["DEPOSE", "ENREGISTRE", "INSTRUCTION", "AUDIENCE", "JUGE"].includes(statut)) return refus("Étape réservée à l'avocat.");
  if (dos.statut === "APPEL_PROPOSE") return refus("L'appel attend l'accord et le règlement du client.");
  if (dos.statut === "PAYE" && statut !== "PRIS_EN_CHARGE") return refus("Acceptez d'abord le dossier.");
  if (statut === "DEPOSE" && !dos.dateLimiteVerifiee) return refus("Vérifiez et fixez d'abord la date limite du recours.");
  if (statut === "DEPOSE" && !(await attestationValide(d, await dernierActe(d, dos.id))))
    return refus("Aucun dépôt sans attestation de l'avocat sur la dernière version de l'acte.");
  if (statut === "PRIS_EN_CHARGE" && dos.statut === "PAYE") return accepter(d, m, dos);
  await d.update(dossiers).set({ statut: statut as Statut, majLe: new Date() }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "STATUT_MODIFIE", details: { de: dos.statut, vers: statut } });
  if (["DEPOSE", "ENREGISTRE", "AUDIENCE", "JUGE", "CLOS"].includes(statut))
    await prevenirClient(d, dos, "Votre dossier avance — LEXPATRIA", `Dossier ${dos.reference} : ${libelleClient(statut as Statut, dos.procedure, dos.avisPrealable).toLowerCase()}.`);
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

/** Validation (ou requalification) par l'avocat du cas reconnu par l'IA à l'orientation. */
export async function validerQualification(d: Base, m: Membre, dos: Dossier, code: string): Promise<Resultat> {
  if (m.role !== "ASSOCIE" && m.role !== "AVOCAT") return refus("Seul un avocat valide la qualification.");
  const triage = (dos.triage ?? {}) as Record<string, unknown>;
  // « LIBRE » : l'avocat valide la qualification rédigée par l'IA hors référentiel.
  const cas = code === "LIBRE" ? casDuTriage([], { casLibre: triage.casLibre }) : trouverCas(await lireParametre(d, "cas"), code);
  if (!cas) return refus("Cas inconnu ou désactivé dans le référentiel.");
  const validation = { cas: cas.code, par: m.id, le: new Date().toISOString(), casIA: triage.cas ?? null };
  await d.update(dossiers).set({ triage: { ...triage, validation }, majLe: new Date() }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "QUALIFICATION_VALIDEE", details: { cas: cas.code, casIA: triage.cas ?? null } });
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
  const mesDossiers = tous ? sql`${dossiers.archiveLe} is null` : sql`${dossiers.avocatId} = ${m.id} and ${dossiers.archiveLe} is null`;
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

export const MOTIFS_ABSENCE: Record<string, string> = {
  CONGES: "Congés",
  FORMATION: "Formation",
  AUDIENCE_EXTERIEURE: "Audience extérieure",
  INDISPONIBLE: "Indisponible",
};

export async function ajouterIndisponibilite(d: Base, par: string, avocatId: string, debut: string, fin: string, motif = "CONGES"): Promise<Resultat> {
  const a = new Date(`${debut}T00:00:00`);
  const b = new Date(`${fin}T23:59:59`);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return refus("Période invalide.");
  if (!(motif in MOTIFS_ABSENCE)) return refus("Motif inconnu.");
  await d.insert(indisponibilites).values({ avocatId, debut: a, fin: b, motif });
  await journaliser(d, { acteur: par, action: "INDISPONIBILITE_AJOUTEE", details: { avocatId, debut, fin, motif } });
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

// ---------- Tableau de bord ----------

const ACTIFS = ["PAYE", "PRIS_EN_CHARGE", "EN_REDACTION", "ACTE_ATTESTE", "DEPOSE", "ENREGISTRE", "INSTRUCTION", "AUDIENCE", "JUGE"] as Statut[];
const nomAvocat = (a: { prenom: string | null; nom: string | null } | null) => (a?.nom ? `Me ${a.prenom ?? ""} ${a.nom.toUpperCase()}`.trim() : null);
const nomClient = (c: { prenom: string | null; nom: string | null }) => `${c.prenom ?? ""} ${(c.nom ?? "").charAt(0).toUpperCase()}.`.trim();

/** Tâches classées par urgence : celles d'un membre, ou celles de tout le cabinet (vision du cabinet). */
export async function tachesDuJour(d: Base, m: Membre, tout: boolean) {
  const { calculerTaches } = await import("@/lib/taches");
  const { consultations } = await import("./agenda");
  const portee = tout ? sql`${dossiers.archiveLe} is null` : sql`${dossiers.avocatId} = ${m.id} and ${dossiers.archiveLe} is null`;
  const lignes = await d
    .select({
      dos: dossiers,
      cli: { prenom: clients.prenom, nom: clients.nom },
      avocat: { prenom: utilisateurs.prenom, nom: utilisateurs.nom },
      aVerifier: sql<number>`(select count(*) from ${pieces} where ${pieces.dossierId} = ${dossiers.id} and ${pieces.verifiee} = false and ${pieces.manquante} = false and jsonb_array_length(${pieces.fichiers}) > 0)`,
      manquantes: sql<number>`(select count(*) from ${pieces} where ${pieces.dossierId} = ${dossiers.id} and ${pieces.manquante} = true)`,
      nonLus: sql<number>`(select count(*) from ${messages} where ${messages.dossierId} = ${dossiers.id} and ${messages.auteur} = 'CLIENT' and ${messages.luLe} is null)`,
    })
    .from(dossiers)
    .innerJoin(clients, eq(clients.id, dossiers.clientId))
    .leftJoin(utilisateurs, eq(utilisateurs.id, dossiers.avocatId))
    .where(and(inArray(dossiers.statut, ACTIFS), portee));
  const actifsT = lignes.map((l) => ({
    ref: l.dos.reference,
    client: nomClient(l.cli),
    procedure: l.dos.procedure,
    statut: l.dos.statut,
    urgence: l.dos.traitement === "URGENCE",
    avis: l.dos.avisPrealable || l.dos.procedure === "DIAGNOSTIC" || l.dos.procedure === "CONSULTATION",
    dateLimite: l.dos.dateLimite,
    acceptationAvant: l.dos.acceptationAvant,
    transmis: !!l.dos.transmisSecretariatLe,
    avocat: nomAvocat(l.avocat),
    piecesAVerifier: Number(l.aVerifier),
    piecesManquantes: Number(l.manquantes),
    messagesNonLus: Number(l.nonLus),
    // Repère pour le tableau de bord ; le poste de travail détermine l'attestation exacte (prise en charge ou dépôt).
    attestationASigner:
      !(l.dos.avisPrealable || l.dos.procedure === "DIAGNOSTIC" || l.dos.procedure === "CONSULTATION") &&
      (genre(l.dos.procedure) === "CONTENTIEUX"
        ? rangStatut(l.dos.statut) >= rangStatut("DEPOSE") && !attestationsClient(l.dos.priseEnCharge).some((a) => a.type === "DEPOT")
        : rangStatut(l.dos.statut) >= rangStatut("ACTE_ATTESTE") && attestationsClient(l.dos.priseEnCharge).length === 0),
  }));
  const ids = lignes.map((l) => l.dos.id);
  const dans30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const ech = ids.length
    ? await d
        .select({ ref: dossiers.reference, type: echeances.type, date: echeances.date })
        .from(echeances)
        .innerJoin(dossiers, eq(dossiers.id, echeances.dossierId))
        .where(and(eq(echeances.faite, false), inArray(echeances.dossierId, ids), sql`${echeances.date} <= ${dans30}`))
    : [];
  const avis = (await consultations(d, m, "a_rendre"))
    .filter((x) => tout || x.dos.avocatId === m.id)
    .map((x) => ({ ref: x.dos.reference, client: nomClient(x.cli), avocat: nomAvocat(x.avocat), rendreAvant: x.rendreAvant }));
  // Le secrétariat garde sa propre liste ; les autres membres voient leurs tâches d'avocat, y compris en vision du cabinet.
  const role = m.role === "SECRETARIAT" ? "SECRETARIAT" : "AVOCAT";
  const taches = calculerTaches(actifsT, ech, avis, role);
  // Vision du cabinet : les dépôts attendus du secrétariat font partie des urgences de l'équipe.
  if (tout && role === "AVOCAT") {
    const depots = calculerTaches(actifsT, [], [], "SECRETARIAT").filter((t) => t.libelle === "Déposer le recours");
    taches.push(...depots.map((t) => ({ ...t, avocat: "Secrétariat" })));
    const rang = { URGENT: 0, SEMAINE: 1, SUIVI: 2 } as const;
    taches.sort((a, b) => rang[a.niveau] - rang[b.niveau] || (a.echeance ?? "9999").localeCompare(b.echeance ?? "9999") || a.ref.localeCompare(b.ref));
  }
  return { taches, enCours: actifsT.length, lignes };
}

/** Données du tableau de bord : bandeau des nouveaux dossiers, tâches, rendez-vous, et pour la vision du cabinet les alertes et l'équipe. */
export async function tableauDeBord(d: Base, m: Membre, vueCabinet: boolean) {
  const { jourParis } = await import("./agenda");
  const { alertesAbsence } = await import("@/lib/taches");
  const cabinet = vueCabinet && voitTout(m) && m.role !== "SECRETARIAT";
  const aujourdhui = jourParis();
  const { taches, enCours, lignes } = await tachesDuJour(d, m, cabinet);

  // Nouveaux dossiers payés, en attente d'acceptation (le bandeau les porte : ils sortent de la liste des tâches).
  const nouveaux = lignes
    .filter((l) => l.dos.statut === "PAYE")
    .map((l) => ({
      ref: l.dos.reference,
      client: nomClient(l.cli),
      procedure: l.dos.procedure,
      urgence: l.dos.traitement === "URGENCE",
      avant: l.dos.acceptationAvant,
      avocat: nomAvocat(l.avocat),
    }))
    .sort((a, b) => (a.avant?.getTime() ?? Infinity) - (b.avant?.getTime() ?? Infinity));
  const liste = taches.filter((t) => t.libelle !== "Accepter le dossier");

  // Rendez-vous du jour du membre (consultations en visio).
  const rdv = lignes
    .filter((l) => l.dos.avocatId === m.id && l.dos.rendezVous)
    .map((l) => ({ ref: l.dos.reference, client: nomClient(l.cli), debut: new Date((l.dos.rendezVous as { debut: string }).debut) }))
    .filter((r) => !isNaN(r.debut.getTime()) && jourParis(r.debut) === aujourdhui)
    .sort((a, b) => a.debut.getTime() - b.debut.getTime());

  if (!cabinet) return { cabinet, aujourdhui, enCours, nouveaux, taches: liste, rdv, alertes: null, equipe: null };

  // Vision du cabinet : dossiers payés sans avocat, échéances pendant une absence, charge de l'équipe.
  const sansAvocat = (
    await d
      .select({ ref: dossiers.reference, procedure: dossiers.procedure, cli: { prenom: clients.prenom, nom: clients.nom }, majLe: dossiers.majLe })
      .from(dossiers)
      .innerJoin(clients, eq(clients.id, dossiers.clientId))
      .where(and(eq(dossiers.statut, "PAYE"), sql`${dossiers.avocatId} is null`, sql`${dossiers.archiveLe} is null`))
  ).map((x) => ({ ref: x.ref, procedure: x.procedure, client: nomClient(x.cli), recuLe: x.majLe }));

  const absences = (
    await d
      .select({ a: indisponibilites })
      .from(indisponibilites)
      .where(gte(indisponibilites.fin, new Date()))
  ).map(({ a }) => ({ avocatId: a.avocatId, debut: jourParis(a.debut), fin: jourParis(a.fin), motif: a.motif }));
  const avantDepot = ["PAYE", "PRIS_EN_CHARGE", "EN_REDACTION", "ACTE_ATTESTE"];
  const echAvocat = lignes
    .filter((l) => l.dos.avocatId && l.dos.dateLimite && avantDepot.includes(l.dos.statut))
    .map((l) => ({ ref: l.dos.reference, client: nomClient(l.cli), procedure: l.dos.procedure, avocatId: l.dos.avocatId!, avocat: nomAvocat(l.avocat), libelle: "Date limite", date: l.dos.dateLimite! }));
  const parRef = new Map(lignes.map((l) => [l.dos.reference, l]));
  const ids = lignes.map((l) => l.dos.id);
  if (ids.length) {
    const autres = await d
      .select({ ref: dossiers.reference, type: echeances.type, date: echeances.date })
      .from(echeances)
      .innerJoin(dossiers, eq(dossiers.id, echeances.dossierId))
      .where(and(eq(echeances.faite, false), inArray(echeances.dossierId, ids), gte(echeances.date, aujourdhui), sql`${echeances.type} <> 'DATE_LIMITE'`));
    const { LIBELLES_ECHEANCE } = await import("./agenda");
    for (const e of autres) {
      const l = parRef.get(e.ref);
      if (l?.dos.avocatId) echAvocat.push({ ref: e.ref, client: nomClient(l.cli), procedure: l.dos.procedure, avocatId: l.dos.avocatId, avocat: nomAvocat(l.avocat), libelle: LIBELLES_ECHEANCE[e.type] ?? e.type, date: e.date });
    }
  }
  const pendantAbsence = alertesAbsence(echAvocat, absences, aujourdhui);

  const membres = await d
    .select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom })
    .from(utilisateurs)
    .where(and(eq(utilisateurs.actif, true), inArray(utilisateurs.role, ["ASSOCIE", "AVOCAT"])))
    .orderBy(utilisateurs.nom);
  const equipe = membres.map((u) => {
    const nom = nomAvocat(u);
    const abs = absences.filter((a) => a.avocatId === u.id).sort((a, b) => a.debut.localeCompare(b.debut))[0] ?? null;
    return {
      nom,
      dossiers: lignes.filter((l) => l.dos.avocatId === u.id).length,
      urgent: liste.filter((t) => t.niveau === "URGENT" && t.avocat === nom).length,
      absence: abs,
    };
  });

  return { cabinet, aujourdhui, enCours, nouveaux, taches: liste, rdv, alertes: { sansAvocat, pendantAbsence }, equipe };
}

/** Tableau de bord du secrétariat : dépôts à faire, pièces à relancer, audiences à venir. */
export async function tableauSecretariat(d: Base) {
  const { jourParis } = await import("./agenda");
  const aujourdhui = jourParis();
  const aDeposer = (
    await d
      .select({ dos: dossiers, cli: { prenom: clients.prenom, nom: clients.nom }, avocat: { prenom: utilisateurs.prenom, nom: utilisateurs.nom } })
      .from(dossiers)
      .innerJoin(clients, eq(clients.id, dossiers.clientId))
      .leftJoin(utilisateurs, eq(utilisateurs.id, dossiers.avocatId))
      .where(and(eq(dossiers.statut, "ACTE_ATTESTE"), sql`${dossiers.transmisSecretariatLe} is not null`, sql`${dossiers.archiveLe} is null`))
  )
    .map((l) => ({
      ref: l.dos.reference,
      client: nomClient(l.cli),
      procedure: l.dos.procedure,
      tribunal: l.dos.tribunal,
      dateLimite: l.dos.dateLimite,
      transmisLe: l.dos.transmisSecretariatLe,
      avocat: nomAvocat(l.avocat),
    }))
    .sort((a, b) => (a.dateLimite ?? "9999").localeCompare(b.dateLimite ?? "9999"));

  const relances = (
    await d
      .select({
        ref: dossiers.reference,
        cli: { prenom: clients.prenom, nom: clients.nom },
        dateLimite: dossiers.dateLimite,
        n: sql<number>`count(*)`,
      })
      .from(pieces)
      .innerJoin(dossiers, eq(dossiers.id, pieces.dossierId))
      .innerJoin(clients, eq(clients.id, dossiers.clientId))
      .where(and(eq(pieces.manquante, true), inArray(dossiers.statut, ["PAYE", "PRIS_EN_CHARGE", "EN_REDACTION", "ACTE_ATTESTE"]), sql`${dossiers.archiveLe} is null`))
      .groupBy(dossiers.reference, clients.prenom, clients.nom, dossiers.dateLimite)
  )
    .map((x) => ({ ref: x.ref, client: nomClient(x.cli), dateLimite: x.dateLimite, n: Number(x.n) }))
    .sort((a, b) => (a.dateLimite ?? "9999").localeCompare(b.dateLimite ?? "9999"));

  const audiences = await d
    .select({ ref: dossiers.reference, date: echeances.date, tribunal: dossiers.tribunal, avocat: { prenom: utilisateurs.prenom, nom: utilisateurs.nom } })
    .from(echeances)
    .innerJoin(dossiers, eq(dossiers.id, echeances.dossierId))
    .leftJoin(utilisateurs, eq(utilisateurs.id, dossiers.avocatId))
    .where(and(eq(echeances.type, "AUDIENCE"), eq(echeances.faite, false), gte(echeances.date, aujourdhui), sql`${dossiers.archiveLe} is null`))
    .orderBy(echeances.date)
    .limit(20);

  return { aujourdhui, aDeposer, relances, audiences: audiences.map((a) => ({ ...a, avocat: nomAvocat(a.avocat) })) };
}

// ---------- Archivage ----------

/** Archive ou désarchive un dossier : associé ou avocat du dossier. Le dossier archivé sort des listes, du tableau de bord et des relances. */
export async function archiver(d: Base, m: Membre, dos: Dossier, archive: boolean): Promise<Resultat> {
  if (m.role === "SECRETARIAT") return refus("Seul un avocat peut archiver un dossier.");
  if (m.role !== "ASSOCIE" && dos.avocatId !== m.id) return refus("Seul l'avocat du dossier ou un associé peut l'archiver.");
  if (archive === !!dos.archiveLe) return { ok: true };
  await d.update(dossiers).set({ archiveLe: archive ? new Date() : null }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: archive ? "DOSSIER_ARCHIVE" : "DOSSIER_DESARCHIVE" });
  return { ok: true };
}
