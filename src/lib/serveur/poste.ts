// Poste de travail de l'avocat : analyse par l'IA, projets d'actes, versions, revue humaine,
// contrôle croisé avant dépôt, attestation de l'avocat et attestation de prise en charge.
// Règles fixes : l'analyse de l'IA n'est jamais transmise au client ; aucun dépôt sans attestation
// de l'avocat liée à la version exacte de l'acte ; toute modification ultérieure exige une nouvelle attestation.

import { extraireJson } from "@/lib/ia";
import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Base } from "@/db";
import { actes, attestations, clients, dossiers, pieces, utilisateurs } from "@/db/schema";
import { empreinteTexte, journaliser } from "@/lib/journal";
import {
  compterManquants,
  genererModele,
  JURIDICTIONNELS,
  LIBELLES_MODELE,
  modelesPour,
  motsModifies,
  procedureLibelle,
  remplirModele,
  tribunalCompetent,
  type CodeModele,
  type DonneesActe,
} from "@/lib/modeles";
import { adresseEnLignes } from "@/lib/pays";
import { rang } from "@/lib/statuts";
import { minimiser } from "@/lib/triage";
import { referencesPour } from "./actes-reference";
import { valeur } from "./connexions";
import { modeleActif } from "./modeles-cabinet";
import type { Dossier } from "./dossiers";
import { envoyer } from "./notifications";
import type { Membre } from "./session";

export type Resultat = { ok: true } | { ok: false; erreur: string };
const refus = (erreur: string): Resultat => ({ ok: false, erreur });
const estAvocat = (m: Membre) => m.role === "ASSOCIE" || m.role === "AVOCAT";
const peutTravailler = (m: Membre, dos: Dossier) => m.role === "ASSOCIE" || (m.role === "AVOCAT" && dos.avocatId === m.id);

// ---------- Données du dossier ----------

export async function donneesActe(d: Base, dos: Dossier): Promise<DonneesActe> {
  const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
  const avocat = dos.avocatId ? ((await d.select().from(utilisateurs).where(eq(utilisateurs.id, dos.avocatId)))[0] ?? null) : null;
  const lesPieces = await d.select().from(pieces).where(eq(pieces.dossierId, dos.id)).orderBy(pieces.numero, pieces.creeLe);
  const q = (dos.qualification ?? {}) as Record<string, unknown>;
  return {
    civilite: cli?.civilite,
    prenom: cli?.prenom,
    nom: cli?.nom,
    procedure: dos.procedure,
    algerien: cli?.algerien,
    prefecture: dos.prefecture,
    dateDecision: dos.dateDecision,
    dateNotification: dos.dateNotification,
    dateLimite: dos.dateLimite,
    situationOQTF: dos.situationOQTF,
    reponses: (q.reponses ?? {}) as Record<string, string | undefined>,
    question: (q.question as string) ?? null,
    avocat: avocat ? { prenom: avocat.prenom, nom: avocat.nom } : null,
    pieces: lesPieces.filter((p) => !p.manquante).map((p) => p.libelle),
    reference: dos.reference,
    adresse: cli ? adresseEnLignes(cli).join(", ") || null : null,
    dateNaissance: cli?.dateNaissance ?? null,
    nationalite: cli?.nationalite ?? null,
    appel: await infoAppel(d, dos),
  };
}

/** Dossier d'appel : tribunal et numéro du jugement, lus sur le dossier de première instance. */
async function infoAppel(d: Base, dos: Dossier) {
  if (!dos.dossierParentId) return null;
  const [p] = await d.select().from(dossiers).where(eq(dossiers.id, dos.dossierParentId));
  return { tribunal: dos.tribunal ?? p?.tribunal ?? tribunalCompetent(dos.prefecture), numero: p?.numeroRequete ?? null, referencePremiere: p?.reference ?? "" };
}

// ---------- Analyse ----------

export interface PointVigilance {
  id: string;
  texte: string;
  tranche: boolean;
}
export interface Analyse {
  resume: string;
  questions: string[];
  appuis: string[];
  strategie: string;
  vigilance: PointVigilance[];
  source: "IA" | "SIMULATION";
  le: string;
}

const AnalyseIA = z.object({
  resume: z.string(),
  questions: z.array(z.string()).max(8),
  appuis: z.array(z.string()).max(10),
  strategie: z.string(),
  vigilance: z.array(z.string()).max(10),
});

/** Points de vigilance que le code impose toujours, quelle que soit l'analyse. */
async function vigilanceSysteme(d: Base, dos: Dossier, x: DonneesActe): Promise<string[]> {
  const v: string[] = [];
  if (!dos.dateLimiteVerifiee) v.push("Date limite calculée automatiquement : vérifiez-la sur la mention des voies et délais de recours de la décision.");
  if (!dos.dateNotification) v.push("Date de notification non établie : vérifiez-la sur l'enveloppe ou l'accusé de réception.");
  const manquantes = await d.select().from(pieces).where(and(eq(pieces.dossierId, dos.id), eq(pieces.manquante, true)));
  if (manquantes.length) v.push(`Pièces non transmises par le client : ${manquantes.map((p) => p.libelle).join(", ")}.`);
  if (!Object.keys(x.reponses).length) v.push("Questionnaire détaillé non rempli par le client : rédigez sur ce qui est établi, sans supposer aucun fait.");
  if (tribunalCompetent(x.prefecture) === "XXX" && !["REFUS_VISA", "NATURALISATION", "DIAGNOSTIC"].includes(dos.procedure))
    v.push("Tribunal compétent non déterminé automatiquement : vérifiez le siège de l'autorité qui a pris la décision.");
  return v;
}

function analyseSimulee(dos: Dossier, x: DonneesActe): Omit<Analyse, "vigilance" | "source" | "le"> & { vigilance: string[] } {
  const r = x.reponses;
  const appuis: string[] = [];
  if (r.entree) appuis.push(`Présence en France alléguée depuis le ${r.entree.split("-").reverse().join("/")}`);
  if (r.famille === "marie" || r.famille === "pacs") appuis.push("Vie familiale en France (conjoint ou partenaire)");
  if (r.enfants && r.enfants !== "0") appuis.push(`${r.enfants} enfant(s)${r.scolarises === "oui" ? " scolarisé(s) en France" : ""}`);
  if (r.activite && r.activite !== "sans") appuis.push("Insertion professionnelle");
  if (r.titreAnt === "oui") appuis.push("Séjour régulier antérieur");
  if (x.algerien) appuis.push("Ressortissant algérien : accord franco-algérien du 27 décembre 1968");
  const questions: Record<string, string[]> = {
    OQTF: ["La décision est-elle régulière en la forme (compétence, motivation) ?", "L'intéressé relève-t-il d'une catégorie protégée contre l'éloignement ?", "La mesure porte-t-elle une atteinte disproportionnée à la vie privée et familiale ?"],
    REFUS_TITRE: ["Les conditions du titre demandé sont-elles remplies ?", "Le refus porte-t-il une atteinte disproportionnée à la vie privée et familiale ?", "Les preuves de présence couvrent-elles chaque année ?"],
    REFUS_IMPLICITE: ["La demande a-t-elle été régulièrement déposée (date, récépissé) ?", "Les motifs du refus ont-ils été demandés (communication des motifs) ?"],
    REFUS_VISA: ["Quel est le motif exact du refus ?", "Le délai de recours devant la commission est-il respecté ?"],
    NATURALISATION: ["Quel est le motif de la décision (insertion, ressources, comportement) ?", "Le recours préalable a-t-il été formé dans le délai ?"],
    BLOCAGE_SIMPLE: ["Les démarches pour obtenir un rendez-vous sont-elles prouvées ?", "Une mise en demeure suffit-elle avant le référé ?"],
    BLOCAGE_EMPLOI: ["L'urgence (emploi menacé) est-elle documentée ?", "Quel référé est le plus adapté ?"],
    PROCEDURE_EN_COURS: ["Où en est l'instruction (mémoires, clôture, audience) ?", "Quels moyens restent à développer ?"],
    DIAGNOSTIC: ["Quelle voie de régularisation est envisageable ?"],
  };
  return {
    resume: `${x.civilite === "MADAME" ? "Madame" : "Monsieur"} ${x.prenom ?? ""} ${x.nom ?? ""}, ${procedureLibelle(dos.procedure).toLowerCase()}.${dos.recit ? ` Récit : « ${minimiser(dos.recit).slice(0, 400)} »` : ""}`,
    questions: questions[dos.procedure] ?? ["Quelle est la décision contestée et sa date de notification ?"],
    appuis,
    strategie: `${LIBELLES_MODELE[modelesPour(dos.procedure, dos.avisPrealable, !!dos.dossierParentId)[0]]} ; centrer la discussion sur ${appuis.length ? "les éléments d'insertion et de vie familiale" : "la régularité de la décision"}.`,
    vigilance: [],
  };
}

export async function analyser(d: Base, m: Membre, dos: Dossier): Promise<Resultat> {
  if (!peutTravailler(m, dos)) return refus("Dossier attribué à un autre avocat.");
  const x = await donneesActe(d, dos);
  const systeme = await vigilanceSysteme(d, dos, x);
  let base: Omit<Analyse, "vigilance" | "source" | "le"> & { vigilance: string[] };
  let source: Analyse["source"] = "SIMULATION";
  const cle = await valeur("ANTHROPIC_API_KEY");
  if (cle) {
    // Données minimisées : ni nom, ni coordonnées, ni numéro d'identification.
    const contexte = {
      procedure: procedureLibelle(dos.procedure),
      recit: dos.recit ? minimiser(dos.recit) : null,
      faitsConfirmes: dos.faitsExtraits,
      reponses: x.reponses,
      algerien: x.algerien,
      prefecture: x.prefecture,
      dates: { decision: x.dateDecision, notification: x.dateNotification, limiteEstimee: x.dateLimite },
      pieces: x.pieces,
    };
    const rep = await new Anthropic({ apiKey: cle }).messages.create({
      model: (await valeur("ANTHROPIC_MODEL")) ?? "claude-sonnet-5",
      max_tokens: 2000,
      system:
        "Tu assistes un avocat au barreau de Paris en droit des étrangers. À partir des éléments du dossier, produis une analyse pour l'avocat seul : résumé factuel, questions juridiques soulevées, points d'appui, stratégie suggérée, points de vigilance. N'invente aucun fait ; signale ce qui manque. Réponds UNIQUEMENT en JSON : {\"resume\":\"\",\"questions\":[],\"appuis\":[],\"strategie\":\"\",\"vigilance\":[]}",
      messages: [
        { role: "user", content: JSON.stringify(contexte) },
      ],
    });
    base = AnalyseIA.parse(extraireJson(rep.content));
    source = "IA";
  } else {
    base = analyseSimulee(dos, x);
  }
  const analyse: Analyse = {
    ...base,
    vigilance: [...systeme, ...base.vigilance].map((t, i) => ({ id: `v${i + 1}`, texte: t, tranche: false })),
    source,
    le: new Date().toISOString(),
  };
  await d.update(dossiers).set({ analyse, majLe: new Date() }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "ANALYSE_IA", details: { source, points: analyse.vigilance.length } });
  return { ok: true };
}

export async function trancher(d: Base, m: Membre, dos: Dossier, pointId: string, tranche: boolean): Promise<Resultat> {
  if (!peutTravailler(m, dos)) return refus("Dossier attribué à un autre avocat.");
  const a = dos.analyse as Analyse | null;
  if (!a) return refus("Aucune analyse.");
  const i = a.vigilance.findIndex((p) => p.id === pointId);
  if (i < 0) return refus("Point inconnu.");
  // Mise à jour atomique d'un seul point (deux clics rapprochés ne s'écrasent pas).
  await d
    .update(dossiers)
    .set({ analyse: sql`jsonb_set(${dossiers.analyse}, ${`{vigilance,${i},tranche}`}::text[], ${tranche ? "true" : "false"}::jsonb)` })
    .where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: tranche ? "POINT_TRANCHE" : "POINT_ROUVERT", details: { pointId } });
  return { ok: true };
}

// ---------- Projets d'actes ----------

export async function dernierActe(d: Base, dossierId: string) {
  const [a] = await d.select().from(actes).where(eq(actes.dossierId, dossierId)).orderBy(desc(actes.creeLe), desc(actes.version)).limit(1);
  return a ?? null;
}

export async function genererProjet(d: Base, m: Membre, dos: Dossier, modele: CodeModele): Promise<Resultat> {
  if (!peutTravailler(m, dos)) return refus("Dossier attribué à un autre avocat.");
  if (!modelesPour(dos.procedure, dos.avisPrealable, !!dos.dossierParentId).includes(modele)) return refus("Modèle non prévu pour cette procédure.");
  const x = await donneesActe(d, dos);
  // Modèle du cabinet (back office) s'il existe, sinon modèle intégré.
  const duCabinet = await modeleActif(d, modele);
  let projet = duCabinet ? remplirModele(duCabinet, x) : genererModele(modele, x);
  const cle = await valeur("ANTHROPIC_API_KEY");
  // Actes déjà rédigés par le cabinet pour ce type d'acte (back office) : exemples de plan, de style et de moyens.
  const references = cle ? await referencesPour(d, modele) : [];
  if (cle) {
    const rep = await new Anthropic({ apiKey: cle }).messages.create({
      model: (await valeur("ANTHROPIC_MODEL")) ?? "claude-sonnet-5",
      max_tokens: 6000,
      system:
        "Tu prépares un projet d'acte pour un avocat au barreau de Paris (droit des étrangers). Tu reçois un modèle et les éléments du dossier. Complète le modèle en développant les moyens à partir des seuls éléments fournis. Règles : n'invente aucun fait, aucune date, aucune référence de jurisprudence ; laisse « XXX » partout où l'information manque ; conserve la structure, les intitulés et la signature ; ton juridique sobre. Renvoie uniquement le texte de l'acte." +
        (duCabinet ? " Ce modèle est celui du cabinet : conserve sa rédaction mot pour mot et ne remplace que les « XXX » que les éléments du dossier permettent de compléter." : "") +
        (references.length
          ? " Tu reçois aussi des ACTES DE RÉFÉRENCE déjà rédigés par le cabinet pour ce type d'acte : inspire-toi de leur plan, de leur style, de leurs formulations et des moyens qui conviennent à ce dossier. N'en reprends jamais les faits, les noms, les dates, les lieux ni les références propres à l'ancienne affaire."
          : ""),
      messages: [
        {
          role: "user",
          content:
            `MODÈLE :\n${projet}\n\nÉLÉMENTS DU DOSSIER (minimisés) :\n${JSON.stringify({ recit: dos.recit ? minimiser(dos.recit) : null, faitsConfirmes: dos.faitsExtraits, reponses: x.reponses, analyse: dos.analyse })}` +
            references.map((r, i) => `\n\nACTE DE RÉFÉRENCE ${i + 1} (« ${r.titre} ») :\n${r.texte}`).join(""),
        },
      ],
    });
    const texte = rep.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    if (texte.length > 200) projet = texte;
  }
  const precedent = await dernierActe(d, dos.id);
  const version = precedent && precedent.type === modele ? precedent.version + 1 : 1;
  await d.insert(actes).values({ dossierId: dos.id, type: modele, version, contenu: projet, texteIA: projet, auteurId: m.id });
  if (rang(dos.statut) < rang("EN_REDACTION")) await d.update(dossiers).set({ statut: "EN_REDACTION", majLe: new Date() }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "PROJET_GENERE", details: { modele, version, source: cle ? "IA" : "MODELE", modeleCabinet: !!duCabinet, references: references.length } });
  return { ok: true };
}

/** Enregistre une nouvelle version : toute attestation antérieure cesse de valoir pour l'acte. */
export async function enregistrerVersion(d: Base, m: Membre, dos: Dossier, contenu: string, secondes: number): Promise<Resultat> {
  if (!peutTravailler(m, dos)) return refus("Dossier attribué à un autre avocat.");
  const precedent = await dernierActe(d, dos.id);
  if (!precedent) return refus("Générez d'abord un projet.");
  const texte = contenu.replace(/\r\n/g, "\n").slice(0, 200_000);
  if (texte === precedent.contenu) return refus("Aucune modification.");
  const base = precedent.texteIA ?? precedent.contenu;
  await d.insert(actes).values({
    dossierId: dos.id,
    type: precedent.type,
    version: precedent.version + 1,
    contenu: texte,
    texteIA: base,
    auteurId: m.id,
    motsModifies: motsModifies(base, texte),
    tempsRevueS: precedent.tempsRevueS + Math.max(0, Math.min(Math.round(secondes), 4 * 3600)),
  });
  // Un acte attesté puis modifié repasse en rédaction.
  if (dos.statut === "ACTE_ATTESTE") await d.update(dossiers).set({ statut: "EN_REDACTION", transmisSecretariatLe: null, majLe: new Date() }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "ACTE_MODIFIE", details: { type: precedent.type, version: precedent.version + 1 } });
  return { ok: true };
}

// ---------- Contrôle croisé et attestation ----------

export interface Controle {
  libelle: string;
  ok: boolean;
}

export async function attestationValide(d: Base, acte: typeof actes.$inferSelect | null) {
  if (!acte) return null;
  const [a] = await d.select().from(attestations).where(eq(attestations.acteId, acte.id)).orderBy(desc(attestations.le)).limit(1);
  return a && a.version === acte.version && a.empreinte === empreinteTexte(acte.contenu) ? a : null;
}

export async function controleCroise(d: Base, dos: Dossier): Promise<Controle[]> {
  const acte = await dernierActe(d, dos.id);
  const x = await donneesActe(d, dos);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const analyse = dos.analyse as Analyse | null;
  const lignes: Controle[] = [];
  if (acte && JURIDICTIONNELS.includes(acte.type as CodeModele)) {
    const premiere = acte.contenu.split("\n").find((l) => l.trim()) ?? "";
    const juridiction = acte.type === "REQUETE_APPEL" ? /COUR ADMINISTRATIVE D'APPEL DE/i : /TRIBUNAL ADMINISTRATIF DE|COUR ADMINISTRATIVE D'APPEL DE/i;
    lignes.push({ libelle: acte.type === "REQUETE_APPEL" ? "Cour compétente indiquée" : "Juridiction compétente indiquée", ok: juridiction.test(premiere) && !premiere.includes("XXX") });
  }
  // Un avis écrit (consultation) n'est pas déposé : pas de contrôle de date limite du recours.
  const avis = acte?.type === "AVIS_ECRIT";
  if (!avis) {
    lignes.push({ libelle: "Date limite vérifiée par l'avocat", ok: dos.dateLimiteVerifiee });
    lignes.push({ libelle: dos.dateLimite ? `Dépôt avant la date limite du ${dos.dateLimite.split("-").reverse().join("/")}` : "Dépôt avant la date limite", ok: !!dos.dateLimite && aujourdhui <= dos.dateLimite });
  }
  lignes.push({ libelle: "Aucune mention XXX restante", ok: !!acte && compterManquants(acte.contenu) === 0 });
  lignes.push({ libelle: avis ? "Avocat signataire nommé" : "Avocat constitué nommé", ok: !!acte && !!x.avocat && acte.contenu.includes(`${x.avocat.prenom} ${x.avocat.nom}`) });
  lignes.push({ libelle: "Points de vigilance tranchés", ok: avis ? !analyse || analyse.vigilance.every((p) => p.tranche) : !!analyse && analyse.vigilance.every((p) => p.tranche) });
  return lignes;
}

export const texteAttestation = (avocat: string) =>
  `J'atteste, ${avocat}, avoir personnellement étudié ce dossier, relu l'intégralité de l'acte, l'avoir modifié et adapté au dossier en tant que de besoin et vérifié les pièces citées. Je fais mienne la version que je valide et j'en assume l'entière responsabilité.`;

export async function attester(d: Base, m: Membre, dos: Dossier): Promise<Resultat> {
  if (!estAvocat(m) || !peutTravailler(m, dos)) return refus("Seul l'avocat en charge du dossier atteste l'acte.");
  const acte = await dernierActe(d, dos.id);
  if (!acte) return refus("Aucun acte à attester.");
  const manque = (await controleCroise(d, dos)).filter((c) => !c.ok);
  if (manque.length) return refus(`Contrôle avant dépôt incomplet : ${manque.map((c) => c.libelle.toLowerCase()).join(" ; ")}.`);
  const texte = texteAttestation(`Maître ${m.prenom} ${m.nom}`);
  await d.insert(attestations).values({ acteId: acte.id, avocatId: m.id, version: acte.version, empreinte: empreinteTexte(acte.contenu), texte });
  if (rang(dos.statut) < rang("ACTE_ATTESTE")) await d.update(dossiers).set({ statut: "ACTE_ATTESTE", majLe: new Date() }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "ACTE_ATTESTE", details: { acteId: acte.id, version: acte.version, empreinte: empreinteTexte(acte.contenu) } });
  return { ok: true };
}

/** Transmission au secrétariat pour le dépôt (Télérecours ou envoi recommandé). */
export async function transmettre(d: Base, m: Membre, dos: Dossier): Promise<Resultat> {
  if (!peutTravailler(m, dos)) return refus("Dossier attribué à un autre avocat.");
  if (!(await attestationValide(d, await dernierActe(d, dos.id)))) return refus("La dernière version de l'acte n'est pas attestée.");
  await d.update(dossiers).set({ transmisSecretariatLe: new Date() }).where(eq(dossiers.id, dos.id));
  const secretariat = await d.select().from(utilisateurs).where(and(eq(utilisateurs.role, "SECRETARIAT"), eq(utilisateurs.actif, true)));
  for (const s of secretariat)
    await envoyer({
      canal: "EMAIL",
      destinataire: s.email,
      sujet: `Dossier ${dos.reference} à déposer`,
      texte: `L'acte du dossier ${dos.reference} est attesté et prêt au dépôt.\n${process.env.URL_PUBLIQUE ?? "https://lexpatria.fr"}/avocat/dossiers/${dos.reference}?onglet=travail`,
    });
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "TRANSMIS_SECRETARIAT" });
  return { ok: true };
}

/** Attestation de prise en charge remise au client, après vérification des dates. */
export async function signerPriseEnCharge(d: Base, m: Membre, dos: Dossier): Promise<Resultat> {
  if (!estAvocat(m) || !peutTravailler(m, dos)) return refus("Seul l'avocat en charge du dossier signe l'attestation.");
  if (!dos.dateLimiteVerifiee) return refus("Vérifiez d'abord la date de notification et la date limite.");
  if (dos.priseEnCharge) return refus("L'attestation est déjà signée.");
  const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
  const le = new Date();
  const texte = `Je soussigné(e), Maître ${m.prenom} ${m.nom}, avocat au barreau de Paris, SELARL VARTIS Avocats (Lexpatria Avocats), 222 boulevard Saint-Germain, 75007 Paris, atteste être chargé(e) de la défense des intérêts de ${cli?.civilite === "MADAME" ? "Madame" : "Monsieur"} ${cli?.prenom ?? ""} ${(cli?.nom ?? "").toUpperCase()} dans le dossier ${dos.reference} (${procedureLibelle(dos.procedure)}).\n\nFait à Paris, le ${le.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}.\n\nMaître ${m.prenom} ${m.nom}`;
  await d.update(dossiers).set({ priseEnCharge: { texte, le: le.toISOString(), avocatId: m.id, empreinte: empreinteTexte(texte) } }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "PRISE_EN_CHARGE_ATTESTEE" });
  if (cli?.email)
    await envoyer({
      canal: "EMAIL",
      destinataire: cli.email,
      sujet: "Votre attestation de prise en charge — LEXPATRIA",
      texte: `Bonjour,\n\nVotre avocat a signé votre attestation de prise en charge. Elle est disponible dans votre espace, rubrique « Documents » : ${process.env.URL_PUBLIQUE ?? "https://lexpatria.fr"}/espace\n\nLEXPATRIA Avocats`,
    });
  return { ok: true };
}

// ---------- Assistant IA du dossier ----------

export async function questionAssistant(d: Base, m: Membre, dos: Dossier, question: string): Promise<{ ok: true; reponse: string } | { ok: false; erreur: string }> {
  if (!peutTravailler(m, dos) && m.role !== "SECRETARIAT") return { ok: false, erreur: "Dossier attribué à un autre avocat." };
  const q = question.trim().slice(0, 2000);
  if (!q) return { ok: false, erreur: "Question vide." };
  const acte = await dernierActe(d, dos.id);
  const cle = await valeur("ANTHROPIC_API_KEY");
  let reponse: string;
  if (cle) {
    const x = await donneesActe(d, dos);
    const rep = await new Anthropic({ apiKey: cle }).messages.create({
      model: (await valeur("ANTHROPIC_MODEL")) ?? "claude-sonnet-5",
      max_tokens: 1500,
      system:
        "Tu es l'assistant d'un avocat au barreau de Paris (droit des étrangers). Tu connais le dossier fourni. Réponds en français, de façon précise et sobre. N'invente ni fait ni jurisprudence ; dis clairement quand une vérification dans les textes ou les pièces est nécessaire. Ta réponse s'adresse à l'avocat seul.",
      messages: [
        {
          role: "user",
          content: `DOSSIER (minimisé) : ${JSON.stringify({ procedure: procedureLibelle(dos.procedure), recit: dos.recit ? minimiser(dos.recit) : null, reponses: x.reponses, analyse: dos.analyse, pieces: x.pieces })}\n\nPROJET D'ACTE ACTUEL :\n${acte?.contenu.slice(0, 30_000) ?? "(aucun)"}\n\nQUESTION : ${q}`,
        },
      ],
    });
    reponse = rep.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  } else {
    const n = acte ? compterManquants(acte.contenu) : 0;
    reponse = `Assistant en mode d'essai (aucune clé Anthropic configurée dans Connexions). ${acte ? `Le projet actuel comporte ${n} mention(s) XXX à compléter.` : "Aucun projet n'est encore généré."} Une fois la clé saisie au back office, l'assistant répondra à partir du dossier, des pièces et du projet.`;
  }
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "ASSISTANT_DOSSIER" });
  return { ok: true, reponse };
}

export { modelesPour };
