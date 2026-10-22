// Modèle de données Lexpatria — base PostgreSQL propre à Lexpatria (séparable de VARTIS Studio).
// Montants en centimes TTC sauf mention HT. Dates en UTC ; affichage en heure de Paris.
// ORM : Drizzle (JavaScript pur, sans binaire à télécharger).

import { boolean, doublePrecision, integer, jsonb, pgEnum, pgSequence, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "./id";

const id = () => text("id").primaryKey().$defaultFn(createId);
const cree = () => timestamp("cree_le", { withTimezone: true }).notNull().defaultNow();

/** Numérotation des codes clients (Cxxxxxx) et des références de dossiers (Dxxxx). */
export const seqClient = pgSequence("seq_client", { startWith: 100001 });
export const seqDossier = pgSequence("seq_dossier", { startWith: 1001 });

export const role = pgEnum("role", ["ASSOCIE", "AVOCAT", "SECRETARIAT", "CONFRERE_LOCAL"]);
export const modeRemuneration = pgEnum("mode_remuneration", [
  "COLLABORATEUR_FIXE_VARIABLE", // 4 500 € HT + 20 % au-delà de 13 500 € HT
  "A_L_ACTE", // sous-traitance, rétrocession par acte
  "AUCUNE", // associé, secrétariat
]);
export const statutDossier = pgEnum("statut_dossier", [
  "PRE_DOSSIER", // parcours commencé, non payé (supprimé après 30 jours)
  "ATTENTE_PROCHE", // convention acceptée, en attente du règlement par un proche
  "APPEL_PROPOSE", // appel proposé par l'avocat, en attente de l'accord et du règlement du client
  "PAYE", // payé, en attente d'acceptation par l'avocat
  "PRIS_EN_CHARGE",
  "EN_REDACTION",
  "ACTE_ATTESTE",
  "DEPOSE",
  "ENREGISTRE",
  "INSTRUCTION",
  "AUDIENCE",
  "JUGE",
  "CLOS",
  "CLOS_REMBOURSE",
]);
export const traitement = pgEnum("traitement", ["NORMAL", "DIRECT", "URGENCE", "EXPIRE", "REFUSE"]);

export const utilisateurs = pgTable("utilisateurs", {
  id: id(),
  email: text("email").notNull().unique(),
  prenom: text("prenom").notNull(),
  nom: text("nom").notNull(),
  role: role("role").notNull(),
  barreau: text("barreau").notNull().default("Paris"),
  titre: text("titre"), // « Docteur en droit »
  photoUrl: text("photo_url"),
  mobile: text("mobile"),
  canalAlerte: text("canal_alerte").notNull().default("SMS"), // SMS | WHATSAPP
  remuneration: modeRemuneration("remuneration").notNull().default("AUCUNE"),
  fixeMensuelHT: integer("fixe_mensuel_ht"),
  seuilVariableHT: integer("seuil_variable_ht"),
  tauxVariable: doublePrecision("taux_variable"),
  validationAssocie: boolean("validation_associe").notNull().default(false),
  attributionOuverte: boolean("attribution_ouverte").notNull().default(true),
  reouvertureLe: timestamp("reouverture_le", { withTimezone: true }),
  charteIAAccepteeLe: timestamp("charte_ia_acceptee_le", { withTimezone: true }),
  entraId: text("entra_id").unique(), // compte Microsoft 365
  actif: boolean("actif").notNull().default(true),
  creeLe: cree(),
});

export const indisponibilites = pgTable("indisponibilites", {
  id: id(),
  avocatId: text("avocat_id").notNull().references(() => utilisateurs.id),
  debut: timestamp("debut", { withTimezone: true }).notNull(),
  fin: timestamp("fin", { withTimezone: true }).notNull(),
  source: text("source").notNull().default("PLATEFORME"), // PLATEFORME | OUTLOOK
  motif: text("motif").notNull().default("CONGES"), // CONGES | FORMATION | AUDIENCE_EXTERIEURE | INDISPONIBLE
  outlookId: text("outlook_id"),
});

export const clients = pgTable("clients", {
  id: id(),
  code: text("code").notNull().unique(), // Cxxxxxx
  civilite: text("civilite"), // MADAME | MONSIEUR
  prenom: text("prenom"),
  nom: text("nom"),
  email: text("email"),
  telephone: text("telephone"),
  dateNaissance: text("date_naissance"), // AAAA-MM-JJ
  nationalite: text("nationalite"),
  adresse: text("adresse"), // adresse postale, exigée avant le paiement (facture, actes, convention)
  codePostal: text("code_postal"),
  ville: text("ville"),
  pays: text("pays"), // ISO 3166-1 alpha-2
  algerien: boolean("algerien"),
  langue: text("langue").notNull().default("fr"),
  consentRelances: boolean("consent_relances").notNull().default(false),
  pennylaneId: text("pennylane_id"), // client créé dans Pennylane
  creeLe: cree(),
});

export const dossiers = pgTable("dossiers", {
  id: id(),
  reference: text("reference").notNull().unique(), // Dxxxx
  clientId: text("client_id").notNull().references(() => clients.id),
  procedure: text("procedure").notNull(), // CodeProcedure
  statut: statutDossier("statut").notNull().default("PRE_DOSSIER"),
  traitement: traitement("traitement").notNull().default("NORMAL"),
  situationOQTF: text("situation_oqtf"),
  prefecture: text("prefecture"),
  tribunal: text("tribunal"),
  cour: text("cour"),
  recit: text("recit"),
  langueRecit: text("langue_recit"),
  triage: jsonb("triage"), // résultat brut de l'orientation par l'IA
  faitsExtraits: jsonb("faits_extraits"), // faits du récit, à confirmer par le client
  qualification: jsonb("qualification"), // réponses avant paiement : type de visa, emploi menacé, échéance, question…
  dateDecision: text("date_decision"),
  dateNotification: text("date_notification"),
  dateLimite: text("date_limite"),
  dateLimiteVerifiee: boolean("date_limite_verifiee").notNull().default(false),
  avisPrealable: boolean("avis_prealable").notNull().default(false),
  avocatId: text("avocat_id").references(() => utilisateurs.id),
  accepteLe: timestamp("accepte_le", { withTimezone: true }),
  acceptationAvant: timestamp("acceptation_avant", { withTimezone: true }),
  numeroRequete: text("numero_requete"),
  dossierParentId: text("dossier_parent_id"), // dossier d'appel → première instance
  sharepointUrl: text("sharepoint_url"),
  source: text("source"), // campagne : visa-dz, meta, tiktok…
  etapeAtteinte: text("etape_atteinte"), // dernier écran atteint avant paiement (relance au point d'arrêt)
  relancesEnvoyees: integer("relances_envoyees").notNull().default(0),
  analyse: jsonb("analyse"), // analyse de l'IA pour l'avocat (jamais transmise au client) : résumé, questions, vigilance…
  priseEnCharge: jsonb("prise_en_charge"), // attestation de prise en charge signée par l'avocat : { texte, le, avocatId, empreinte }
  transmisSecretariatLe: timestamp("transmis_secretariat_le", { withTimezone: true }),
  avisTransmisLe: timestamp("avis_transmis_le", { withTimezone: true }), // consultations : avis écrit remis au client
  derniereRelanceLe: timestamp("derniere_relance_le", { withTimezone: true }),
  creeLe: cree(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

export const pieces = pgTable("pieces", {
  id: id(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  type: text("type").notNull(), // DECISION | ENVELOPPE | PASSEPORT | TITRE | …
  libelle: text("libelle").notNull(),
  numero: integer("numero"),
  manquante: boolean("manquante").notNull().default(false), // « Je ne l'ai pas »
  fichiers: jsonb("fichiers").notNull().default([]), // [{ cle, nom, mime, taille, empreinte }]
  extraction: jsonb("extraction"), // données lues par l'IA, jamais réputées vérifiées
  verifiee: boolean("verifiee").notNull().default(false),
  creeLe: cree(),
});

export const paiements = pgTable("paiements", {
  id: id(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  stripeSessionId: text("stripe_session_id").unique(),
  stripeIntentId: text("stripe_intent_id"),
  moyen: text("moyen"), // card | klarna
  montant: integer("montant").notNull(),
  lignes: jsonb("lignes").notNull(), // [{ diligence, libelle, montant }]
  parTiers: boolean("par_tiers").notNull().default(false),
  statut: text("statut").notNull(), // EN_ATTENTE | PAYE | ECHOUE | REMBOURSE | PARTIEL
  rembourseMontant: integer("rembourse_montant"),
  pennylaneId: text("pennylane_id"), // facture créée dans Pennylane
  pennylaneErreur: text("pennylane_erreur"),
  creeLe: cree(),
});

export const conventions = pgTable("conventions_acceptees", {
  id: id(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  type: text("type").notNull().default("CONVENTION"), // CONVENTION | AVENANT_APPEL | AVENANT_FRAIS | AVENANT_REFERE
  version: text("version").notNull(),
  texte: text("texte").notNull(), // texte exact accepté
  empreinte: text("empreinte").notNull(), // SHA-256 du texte
  ip: text("ip").notNull(),
  executionImmediate: boolean("execution_immediate").notNull(),
  accepteeLe: cree(),
});

export const actes = pgTable("actes", {
  id: id(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  type: text("type").notNull(), // code du modèle : REQUETE_OQTF | REQUETE_REFUS_TITRE | REFERE_SUSPENSION | RAPO_VISA | …
  version: integer("version").notNull().default(1),
  contenu: text("contenu").notNull(),
  texteIA: text("texte_ia"), // projet tel que proposé par l'IA (base du compte des mots modifiés)
  auteurId: text("auteur_id"),
  motsModifies: integer("mots_modifies").notNull().default(0),
  tempsRevueS: integer("temps_revue_s").notNull().default(0),
  depose: boolean("depose").notNull().default(false),
  deposeLe: timestamp("depose_le", { withTimezone: true }),
  creeLe: cree(),
});

export const attestations = pgTable("attestations", {
  id: id(),
  acteId: text("acte_id").notNull().references(() => actes.id),
  avocatId: text("avocat_id").notNull().references(() => utilisateurs.id),
  version: integer("version").notNull(),
  empreinte: text("empreinte").notNull(), // version exacte attestée ; toute modification l'annule
  texte: text("texte").notNull(),
  le: cree(),
});

export const messages = pgTable("messages", {
  id: id(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  auteur: text("auteur").notNull(), // CLIENT | AVOCAT | ASSISTANT | SECRETARIAT
  auteurId: text("auteur_id"),
  contenu: text("contenu").notNull(),
  afficheLe: timestamp("affiche_le", { withTimezone: true }),
  luLe: timestamp("lu_le", { withTimezone: true }),
  creeLe: cree(),
});

export const echeances = pgTable("echeances", {
  id: id(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  type: text("type").notNull(), // DATE_LIMITE | MEMOIRE_COMPLEMENTAIRE | AUDIENCE | CLOTURE | APPEL | REPONSE_MOTIFS
  date: text("date").notNull(),
  faite: boolean("faite").notNull().default(false),
  rappelLe: text("rappel_le"), // AAAA-MM-JJ du dernier rappel envoyé à l'avocat (la veille, puis le jour)
  outlookId: text("outlook_id"), // événement créé dans l'agenda Outlook de l'avocat
});

/** Journal inaltérable : chaque entrée chaîne l'empreinte de la précédente. */
export const journal = pgTable("journal", {
  id: id(),
  dossierId: text("dossier_id").references(() => dossiers.id),
  acteur: text("acteur").notNull(), // id utilisateur, CLIENT, SYSTEME, CLAUDE
  action: text("action").notNull(),
  details: jsonb("details"),
  empreinte: text("empreinte").notNull(),
  precedente: text("precedente"),
  le: cree(),
});

/** Paramètres du back office (prix, délais, textes, fonctionnalités). */
export const parametres = pgTable("parametres", {
  cle: text("cle").primaryKey(),
  valeur: jsonb("valeur").notNull(),
  majPar: text("maj_par"),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

/** Codes de connexion à usage unique (espace client et espace cabinet), hachés. */
export const codesConnexion = pgTable("codes_connexion", {
  id: id(),
  espace: text("espace").notNull().default("CLIENT"), // CLIENT | EQUIPE
  email: text("email"), // adresse à laquelle le code a été envoyé (en minuscules)
  clientId: text("client_id").references(() => clients.id),
  utilisateurId: text("utilisateur_id").references(() => utilisateurs.id),
  dossierId: text("dossier_id"),
  empreinte: text("empreinte").notNull(),
  canal: text("canal").notNull(), // SMS | EMAIL
  expireLe: timestamp("expire_le", { withTimezone: true }).notNull(),
  utiliseLe: timestamp("utilise_le", { withTimezone: true }),
  essais: integer("essais").notNull().default(0),
});

/** Événements d'entonnoir, anonymes (suivi des abandons). */
export const evenementsParcours = pgTable("evenements_parcours", {
  id: id(),
  session: text("session").notNull(),
  etape: text("etape").notNull(),
  motif: text("motif"), // motif d'abandon déclaré (facultatif) : trop cher, réfléchir, parler à quelqu'un
  procedure: text("procedure"),
  source: text("source"),
  appareil: text("appareil"),
  langue: text("langue"),
  le: cree(),
});


/** Historique des paramètres du back office : chaque modification conserve la valeur précédente (retour arrière). */
export const parametresHistorique = pgTable("parametres_historique", {
  id: id(),
  cle: text("cle").notNull(),
  avant: jsonb("avant"), // null : valeur par défaut du code
  apres: jsonb("apres").notNull(),
  majPar: text("maj_par").notNull(), // id utilisateur
  origine: text("origine").notNull().default("MANUEL"), // MANUEL | ASSISTANT | RETOUR_ARRIERE
  motif: text("motif"),
  le: cree(),
});

/** Propositions de l'assistant du back office : rien n'est appliqué sans validation d'un associé. */
export const propositions = pgTable("propositions", {
  id: id(),
  auteurId: text("auteur_id").notNull().references(() => utilisateurs.id),
  demande: text("demande").notNull(),
  resume: text("resume"),
  changements: jsonb("changements").notNull().default([]), // [{ cle, avant, apres }]
  alertes: jsonb("alertes").notNull().default([]), // filtre déontologique, contrôles
  statut: text("statut").notNull().default("PROPOSEE"), // PROPOSEE | APPLIQUEE | REJETEE | ECHEC
  traiteePar: text("traitee_par"),
  traiteeLe: timestamp("traitee_le", { withTimezone: true }),
  creeLe: cree(),
});

/** Connexions aux services externes (API) saisies au back office. Valeurs chiffrées (AES-256-GCM), jamais réaffichées. */
export const connexions = pgTable("connexions", {
  service: text("service").primaryKey(), // stripe, brevo, anthropic…
  chiffre: text("chiffre").notNull(), // iv.tag.donnees (base64url)
  apercus: jsonb("apercus").notNull().default({}), // { CHAMP: "••••1234" } pour l'affichage
  majPar: text("maj_par").notNull(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
  testLe: timestamp("test_le", { withTimezone: true }),
  testOk: boolean("test_ok"),
  testMessage: text("test_message"),
});

// ---------- Lot 5 : intégrations ----------

/** Documents classés dans SharePoint (un document n'est déposé qu'une fois). */
export const archives = pgTable("archives", {
  id: id(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  cle: text("cle").notNull(), // piece:<id>:<i> | acte:<id>:v<n> | convention:<id> | avis
  chemin: text("chemin").notNull(),
  le: cree(),
});

/** Courriers recommandés envoyés par Maileva. */
export const envois = pgTable("envois", {
  id: id(),
  dossierId: text("dossier_id").notNull().references(() => dossiers.id),
  acteId: text("acte_id").notNull().references(() => actes.id),
  prestataire: text("prestataire").notNull().default("MAILEVA"),
  idExterne: text("id_externe"),
  statut: text("statut").notNull(), // SIMULE | ENVOYE | DISTRIBUE | ERREUR | statut Maileva
  destinataire: text("destinataire").notNull(),
  par: text("par").notNull(),
  message: text("message"),
  creeLe: cree(),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

/** Dernière exécution de chaque synchronisation (affichée au back office). */
export const synchronisations = pgTable("synchronisations", {
  service: text("service").primaryKey(), // outlook | sharepoint | pennylane | maileva
  le: timestamp("le", { withTimezone: true }).notNull(),
  ok: boolean("ok").notNull(),
  message: text("message").notNull(),
});

/** Modèles d'actes du cabinet (back office) : chaque enregistrement est une version ; la plus récente s'applique.
 *  Un texte vide rend la main au modèle intégré à la plateforme. */
export const modelesCabinet = pgTable("modeles_cabinet", {
  id: id(),
  code: text("code").notNull(), // CodeModele
  version: integer("version").notNull(),
  texte: text("texte").notNull(),
  fichier: text("fichier"), // nom du fichier Word importé, le cas échéant
  auteurId: text("auteur_id").notNull(),
  creeLe: cree(),
});
