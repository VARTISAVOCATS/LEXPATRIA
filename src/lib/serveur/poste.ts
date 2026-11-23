// Poste de travail de l'avocat : analyse par l'IA, projets d'actes, versions, revue humaine,
// contrôle croisé avant dépôt, attestation de l'avocat et attestation de prise en charge.
// Règles fixes : l'analyse de l'IA n'est jamais transmise au client ; aucun dépôt sans attestation
// de l'avocat liée à la version exacte de l'acte ; toute modification ultérieure exige une nouvelle attestation.

import { extraireJson, listeTolerante } from "@/lib/ia";
import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Base } from "@/db";
import { actes, attestations, clients, dossiers, pieces, utilisateurs } from "@/db/schema";
import { empreinteTexte, journaliser } from "@/lib/journal";
import {
  compterManquants,
  genererModele,
  accorder,
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
import { casDuTriage } from "@/lib/cas";
import { lireParametre } from "./parametres";
import { valeur } from "./connexions";
import { modeleActif } from "./modeles-cabinet";
import { lire, type FichierStocke } from "./stockage";
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

// Lecture tolérante : un champ absent ou trop long ne fait pas échouer l'analyse.
// Avis court de l'agent juridique : l'avis et ses fondements ; le développement est réservé au projet d'acte.
const AnalyseIA = z
  .object({
    avis: z.string().catch(""),
    fondements: z.unknown().transform((x) => listeTolerante(x, 6)),
    vigilance: z.unknown().transform((x) => listeTolerante(x, 6)),
  })
  .transform((a) => ({ resume: a.avis, questions: [] as string[], appuis: a.fondements, strategie: "", vigilance: a.vigilance }));

/** Points de vigilance que le code impose toujours, quelle que soit l'analyse. */
async function vigilanceSysteme(d: Base, dos: Dossier, x: DonneesActe): Promise<string[]> {
  const v: string[] = [];
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

/** Qualification du dossier : cas validé par l'avocat, à défaut cas reconnu par l'IA, et lecture de la décision. */
export async function qualificationDossier(d: Base, dos: Dossier) {
  const t = (dos.triage ?? {}) as { cas?: string | null; casLibre?: unknown; confiance?: string; qualification?: unknown; validation?: { cas: string } | null };
  const cas = casDuTriage(await lireParametre(d, "cas"), t, true);
  return {
    cas: cas ?? null,
    validee: !!t.validation?.cas,
    pourIA: cas
      ? {
          cas: cas.libelle,
          validePar: t.validation?.cas ? "avocat" : cas.libre ? "IA, hors référentiel, non encore validé" : "IA, non encore validé",
          voie: cas.voieClient,
          juridiction: cas.juridiction,
          delai: cas.delai,
          vigilance: cas.vigilance,
          lectureDecision: t.qualification ?? null,
        }
      : { lectureDecision: t.qualification ?? null },
  };
}

/** Modèles proposés : celui du cas qualifié en premier. */
export async function modelesDuDossier(d: Base, dos: Dossier): Promise<CodeModele[]> {
  const base = modelesPour(dos.procedure, dos.avisPrealable, !!dos.dossierParentId);
  if (dos.avisPrealable || dos.dossierParentId) return base;
  // Blocage sans urgence établie : la mise en demeure reste le premier acte.
  if (dos.procedure === "BLOCAGE_SIMPLE") return base;
  const { cas } = await qualificationDossier(d, dos);
  return cas ? [cas.modele, ...base.filter((m) => m !== cas.modele)] : base;
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
      qualification: (await qualificationDossier(d, dos)).pourIA,
      recit: dos.recit ? minimiser(dos.recit) : null,
      faitsConfirmes: dos.faitsExtraits,
      reponses: x.reponses,
      algerien: x.algerien,
      prefecture: x.prefecture,
      dates: { decision: x.dateDecision, notification: x.dateNotification, limiteEstimee: x.dateLimite },
      pieces: x.pieces,
    };
    const rep = await new Anthropic({ apiKey: cle }).messages
      .stream({
      model: (await valeur("ANTHROPIC_MODEL")) ?? "claude-sonnet-5",
      max_tokens: 6000,
      system:
        "Tu es l'agent juridique d'un cabinet d'avocats au barreau de Paris en droit des étrangers. Lis les pièces jointes (décision contestée : autorité, signataire, date, motifs, mesures, voies et délais, tribunal compétent) et les éléments du dossier, puis donne à l'avocat ton AVIS : court, net, comme une note d'avocat à un confrère. Réponds UNIQUEMENT en JSON : {\"avis\":\"\",\"fondements\":[],\"vigilance\":[]}. « avis » : quatre à six phrases au plus, qui disent la voie à suivre et les moyens les plus solides au vu des motifs de la décision et de la situation. « fondements » : trois à six lignes, chacune un texte précis (article et code ou convention) suivi en quelques mots de la raison pour laquelle il s'applique. « vigilance » : deux à cinq points concrets que l'avocat doit trancher ou vérifier avant le dépôt. Pas de développement : il viendra dans la requête. N'invente aucun fait ni aucune jurisprudence.",

      messages: [
        { role: "user", content: [...(await blocsPieces(d, dos)), { type: "text", text: `ÉLÉMENTS DU DOSSIER : ${JSON.stringify(contexte)}` }] },
      ],
    })
      .finalMessage();
    // Réponse illisible (JSON tronqué ou mal formé) : analyse de secours plutôt qu'un échec.
    try {
      base = AnalyseIA.parse(extraireJson(rep.content));
      source = "IA";
    } catch (e) {
      console.error("Analyse IA illisible :", rep.stop_reason, e instanceof Error ? e.message : e);
      base = analyseSimulee(dos, x);
    }
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

type BlocPiece =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

const IMAGES_LUES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** Photo réduite pour la lecture par l'IA : 2 000 pixels au plus sur le grand côté, JPEG, orientation corrigée.
 *  Le texte d'une décision reste lisible et le poids tombe sous le plafond de 5 Mo de l'API. Sans l'outil de
 *  traitement d'image, la photo d'origine est gardée si elle passe sous le plafond. */
async function reduirePhoto(donnees: Buffer): Promise<{ data: Buffer; mime: "image/jpeg" } | null> {
  try {
    const sharp = (await import("sharp")).default;
    const data = await sharp(donnees).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    return { data, mime: "image/jpeg" };
  } catch (e) {
    console.error("Réduction de photo impossible :", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Pièces jointes à la demande faite à l'IA (photos et PDF) : toutes les pièces du dossier, décision et notification en
 *  tête, pour qu'elle en tire dates, autorité, signataire, motifs, tribunal compétent et éléments de situation.
 *  Transmission encadrée par le contrat du prestataire (sous-traitant, sans entraînement). Les photos sont réduites
 *  avant l'envoi ; plafonds : 20 fichiers et 20 Mo transmis au total (limite d'une demande : 32 Mo après encodage). */
export async function blocsPieces(d: Base, dos: Dossier): Promise<BlocPiece[]> {
  const rangPiece = (t: string) => (t === "DECISION" ? 0 : t === "ENVELOPPE" ? 1 : 2);
  const liste = (await d.select().from(pieces).where(eq(pieces.dossierId, dos.id)).orderBy(pieces.numero, pieces.creeLe)).sort((a, b) => rangPiece(a.type) - rangPiece(b.type));
  const blocs: BlocPiece[] = [];
  let total = 0;
  let n = 0;
  for (const p of liste) {
    for (const f of (p.fichiers as FichierStocke[] | null) ?? []) {
      if (n >= 20) break;
      const image = f.mime.startsWith("image/");
      const pdf = f.mime === "application/pdf";
      if (!image && !pdf) continue;
      const brut = await lire(f.cle).catch(() => null);
      if (!brut) continue;
      let bloc: BlocPiece;
      let poids: number;
      if (image) {
        const reduite = await reduirePhoto(brut);
        const garde = reduite ?? ((IMAGES_LUES as readonly string[]).includes(f.mime) && brut.length <= 4_500_000 ? { data: brut, mime: f.mime as (typeof IMAGES_LUES)[number] } : null);
        if (!garde) continue;
        bloc = { type: "image", source: { type: "base64", media_type: garde.mime, data: garde.data.toString("base64") } };
        poids = garde.data.length;
      } else {
        bloc = { type: "document", source: { type: "base64", media_type: "application/pdf", data: brut.toString("base64") } };
        poids = brut.length;
      }
      if (total + poids > 20_000_000) continue;
      total += poids;
      n++;
      blocs.push({ type: "text", text: `PIÈCE : ${p.libelle} (${f.nom})` }, bloc);
    }
  }
  return blocs;
}

const REDACTION_ACTE = [
  "Tu rédiges, pour un avocat au barreau de Paris en droit des étrangers, un acte complet, détaillé et argumenté, prêt à être relu puis déposé. Le modèle de départ ne donne que le plan, les mentions obligatoires et la signature : un acte sommaire n'est pas acceptable.",
  "Faits et procédure : un récit chronologique précis et rédigé, qui reprend chaque élément concret du dossier (entrée en France, durée de présence, titres détenus, démarches, situation familiale, enfants et scolarité, emploi et ancienneté, insertion, décision contestée et ses mesures).",
  "Discussion : pour chaque moyen retenu, rédige plusieurs paragraphes : le texte applicable, cité avec précision (article et code ou convention : CESEDA, code des relations entre le public et l'administration, code de justice administrative, convention européenne des droits de l'homme, convention internationale des droits de l'enfant, accord franco-algérien le cas échéant), puis son application détaillée aux faits du dossier, puis la conclusion sur l'illégalité. Les moyens de légalité externe (compétence du signataire, motivation, examen particulier, procédure contradictoire) sont présentés comme à vérifier sur la décision. Développe longuement les moyens de légalité interne que le dossier nourrit (vie privée et familiale, intérêt supérieur de l'enfant, erreur manifeste d'appréciation, droit au séjour, catégories protégées) ; écarte ceux que rien dans le dossier ne soutient.",
  "Exploite toutes les informations disponibles : les PIÈCES JOINTES (décision contestée, preuve de notification, pièce d'identité, titres de séjour, justificatifs de vie familiale, d'emploi, de scolarité et de présence, pièces de procédure) et les éléments du dossier (identité, adresse, réponses au questionnaire, récit). Tire de la décision : l'autorité et le signataire, sa date et celle de la notification, ses motifs et les textes qu'elle vise, les mesures qui l'accompagnent (délai de départ, interdiction de retour, pays de destination). Tire des autres pièces l'identité complète (date et lieu de naissance, nationalité), l'historique du séjour et tous les éléments concrets de situation, et renvoie à chaque pièce utile dans la discussion. Le tribunal administratif compétent est celui qu'indique la mention des voies et délais de recours de la décision, ou à défaut celui du ressort de la préfecture auteur de la décision : renseigne-le dans l'en-tête. Discute précisément les motifs de la décision tels qu'ils y figurent. Une donnée lue dans une pièce n'est pas un fait inventé.",
  "Suis le plan et les intitulés du modèle de départ, qui reprennent l'usage du cabinet. Pour une requête : en-tête « À / POUR / CONTRE », puis « À l'honneur de vous exposer » ; dans le rappel des faits, chaque élément est suivi de la pièce qui l'établit, sur sa propre ligne (« Pièce n° 4 : Titre de séjour de l'épouse »), avec une numérotation identique à celle du bordereau, et le récit se clôt par « C'est dans cet état que se présente cette affaire. » ; la discussion examine chaque décision séparément (refus de séjour, obligation de quitter le territoire, pays de renvoi), en A. légalité externe puis B. légalité interne, et chaque moyen est rédigé en deux temps : « En droit » (le texte cité entre guillemets) puis « En l'espèce » (son application aux faits et aux pièces) ; les conclusions distinguent « À titre principal », « À titre subsidiaire » et « En tout état de cause ».",
  "L'acte doit être complet de bout en bout : en-tête, faits et procédure, discussion avec tous les moyens, « PAR CES MOTIFS » suivi de toutes les demandes, signature, bordereau des pièces. Ne t'arrête jamais avant les conclusions.",
  "Conclusions : complètes et adaptées à la procédure (annulation, injonction de délivrer un titre ou de réexaminer avec délai et astreinte, frais de l'article L. 761-1 du code de justice administrative).",
  "Règles absolues : n'invente aucun fait, aucune date, aucun nom ; ne cite aucune décision de justice (numéro, date, juridiction) sauf si elle figure dans le modèle de départ ou dans un acte de référence fourni ; écris « XXX » partout où une information manque. Accorde tout le texte au genre de la personne d'après la civilité (jamais « il/elle » ni « né(e) »). Style juridique sobre, phrases complètes, sans formules creuses. Renvoie uniquement le texte de l'acte, sans commentaire.",
].join(" ");

export async function dernierActe(d: Base, dossierId: string) {
  const [a] = await d.select().from(actes).where(eq(actes.dossierId, dossierId)).orderBy(desc(actes.creeLe), desc(actes.version)).limit(1);
  return a ?? null;
}

export async function genererProjet(d: Base, m: Membre, dos: Dossier, modele: CodeModele): Promise<Resultat> {
  if (!peutTravailler(m, dos)) return refus("Dossier attribué à un autre avocat.");
  if (!(await modelesDuDossier(d, dos)).includes(modele)) return refus("Modèle non prévu pour cette procédure.");
  const x = await donneesActe(d, dos);
  // Modèle du cabinet (back office) s'il existe, sinon modèle intégré.
  const duCabinet = await modeleActif(d, modele);
  let projet = duCabinet ? remplirModele(duCabinet, x) : genererModele(modele, x);
  const cle = await valeur("ANTHROPIC_API_KEY");
  // Actes déjà rédigés par le cabinet pour ce type d'acte (back office) : exemples de plan, de style et de moyens.
  const references = cle ? await referencesPour(d, modele) : [];
  if (cle) {
    const joints = await blocsPieces(d, dos);
    const client = new Anthropic({ apiKey: cle });
    const modeleIA = (await valeur("ANTHROPIC_MODEL")) ?? "claude-sonnet-5";
    const systeme =
          REDACTION_ACTE +
          (duCabinet ? " Ce modèle est celui du cabinet : conserve sa rédaction, son plan et ses intitulés ; développe les moyens et remplace les « XXX » que les éléments du dossier permettent de compléter." : "") +
          (references.length
            ? " Tu reçois aussi des ACTES DE RÉFÉRENCE déjà rédigés par le cabinet pour ce type d'acte : inspire-toi de leur plan, de leur style, de leurs formulations et des moyens qui conviennent à ce dossier. N'en reprends jamais les faits, les noms, les dates, les lieux ni les références propres à l'ancienne affaire."
            : "");
    const demande =
              `MODÈLE DE DÉPART :\n${projet}\n\nÉLÉMENTS DU DOSSIER (minimisés) :\n${JSON.stringify({ civilite: x.civilite, identite: { prenom: x.prenom, nom: x.nom, dateNaissance: x.dateNaissance, nationalite: x.nationalite, adresse: x.adresse }, prefecture: x.prefecture, tribunalEstime: x.prefecture ? tribunalCompetent(x.prefecture) : null, qualification: (await qualificationDossier(d, dos)).pourIA, recit: dos.recit ? minimiser(dos.recit) : null, faitsConfirmes: dos.faitsExtraits, reponses: x.reponses, dates: { decision: x.dateDecision, notification: x.dateNotification, limite: x.dateLimite }, pieces: x.pieces, analyse: dos.analyse })}` +
              references.map((r, i) => `\n\nACTE DE RÉFÉRENCE ${i + 1} (« ${r.titre} ») :\n${r.texte}`).join("");
    // Flux : une requête longue dépasse sans risque les délais d'attente d'une réponse unique.
    const rep = await client.messages
      .stream({
        model: modeleIA,
        max_tokens: 20000,
        system: systeme,
        messages: [{ role: "user", content: [...joints, { type: "text", text: demande }] }],
      })
      .finalMessage();
    let texte = rep.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    // Réponse coupée ou acte inachevé (sans conclusions) : l'IA poursuit là où elle s'est arrêtée, deux fois au plus.
    let dernier = rep;
    for (let tour = 0; tour < 2 && texte.length > 200 && (dernier.stop_reason === "max_tokens" || !/PAR CES MOTIFS/i.test(texte)); tour++) {
      dernier = await client.messages
        .stream({
          model: modeleIA,
          max_tokens: 16000,
          system: systeme,
          messages: [
            { role: "user", content: [...joints, { type: "text", text: demande }] },
            { role: "assistant", content: texte },
            { role: "user", content: "L'acte est inachevé. Poursuis la rédaction exactement là où tu t'es arrêté, sans rien répéter, jusqu'aux conclusions (« PAR CES MOTIFS » et les demandes), la signature et le bordereau des pièces. Renvoie uniquement la suite du texte." },
          ],
        })
        .finalMessage();
      texte = `${texte}\n${dernier.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim()}`;
    }
    // Filet : si les conclusions manquent encore, celles du modèle de départ sont ajoutées pour relecture.
    if (texte.length > 200 && !/PAR CES MOTIFS/i.test(texte) && /PAR CES MOTIFS/.test(projet)) texte += `\n\n${projet.slice(projet.indexOf("PAR CES MOTIFS"))}`;
    if (texte.length > 200) projet = accorder(texte, x.civilite);
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
    lignes.push({ libelle: dos.dateLimite ? `Dépôt avant la date limite du ${dos.dateLimite.split("-").reverse().join("/")}` : "Dépôt avant la date limite", ok: !!dos.dateLimite && aujourdhui <= dos.dateLimite });
  }
  lignes.push({ libelle: "Aucune mention XXX restante", ok: !!acte && compterManquants(acte.contenu) === 0 });
  lignes.push({ libelle: avis ? "Avocat signataire nommé" : "Avocat constitué nommé", ok: !!acte && !!x.avocat && acte.contenu.includes(`${x.avocat.prenom} ${x.avocat.nom}`) });
  lignes.push({ libelle: "Points à trancher cochés", ok: avis ? !analyse || analyse.vigilance.every((p) => p.tranche) : !!analyse && analyse.vigilance.every((p) => p.tranche) });
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
          content: `DOSSIER (minimisé) : ${JSON.stringify({ procedure: procedureLibelle(dos.procedure), qualification: (await qualificationDossier(d, dos)).pourIA, recit: dos.recit ? minimiser(dos.recit) : null, reponses: x.reponses, analyse: dos.analyse, pieces: x.pieces })}\n\nPROJET D'ACTE ACTUEL :\n${acte?.contenu.slice(0, 30_000) ?? "(aucun)"}\n\nQUESTION : ${q}`,
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
