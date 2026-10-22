CREATE TYPE "public"."mode_remuneration" AS ENUM('COLLABORATEUR_FIXE_VARIABLE', 'A_L_ACTE', 'AUCUNE');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ASSOCIE', 'AVOCAT', 'SECRETARIAT', 'CONFRERE_LOCAL');--> statement-breakpoint
CREATE TYPE "public"."statut_dossier" AS ENUM('PRE_DOSSIER', 'ATTENTE_PROCHE', 'PAYE', 'PRIS_EN_CHARGE', 'EN_REDACTION', 'ACTE_ATTESTE', 'DEPOSE', 'ENREGISTRE', 'INSTRUCTION', 'AUDIENCE', 'JUGE', 'CLOS', 'CLOS_REMBOURSE');--> statement-breakpoint
CREATE TYPE "public"."traitement" AS ENUM('NORMAL', 'DIRECT', 'URGENCE', 'EXPIRE', 'REFUSE');--> statement-breakpoint
CREATE SEQUENCE "public"."seq_client" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 100001 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."seq_dossier" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
CREATE TABLE "actes" (
	"id" text PRIMARY KEY NOT NULL,
	"dossier_id" text NOT NULL,
	"type" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"contenu" text NOT NULL,
	"mots_modifies" integer DEFAULT 0 NOT NULL,
	"temps_revue_s" integer DEFAULT 0 NOT NULL,
	"depose" boolean DEFAULT false NOT NULL,
	"depose_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attestations" (
	"id" text PRIMARY KEY NOT NULL,
	"acte_id" text NOT NULL,
	"avocat_id" text NOT NULL,
	"version" integer NOT NULL,
	"empreinte" text NOT NULL,
	"texte" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"civilite" text,
	"prenom" text,
	"nom" text,
	"email" text,
	"telephone" text,
	"date_naissance" text,
	"nationalite" text,
	"algerien" boolean,
	"langue" text DEFAULT 'fr' NOT NULL,
	"consent_relances" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "codes_connexion" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"dossier_id" text,
	"empreinte" text NOT NULL,
	"canal" text NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"utilise_le" timestamp with time zone,
	"essais" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conventions_acceptees" (
	"id" text PRIMARY KEY NOT NULL,
	"dossier_id" text NOT NULL,
	"type" text DEFAULT 'CONVENTION' NOT NULL,
	"version" text NOT NULL,
	"texte" text NOT NULL,
	"empreinte" text NOT NULL,
	"ip" text NOT NULL,
	"execution_immediate" boolean NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dossiers" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"client_id" text NOT NULL,
	"procedure" text NOT NULL,
	"statut" "statut_dossier" DEFAULT 'PRE_DOSSIER' NOT NULL,
	"traitement" "traitement" DEFAULT 'NORMAL' NOT NULL,
	"situation_oqtf" text,
	"prefecture" text,
	"tribunal" text,
	"cour" text,
	"recit" text,
	"langue_recit" text,
	"triage" jsonb,
	"faits_extraits" jsonb,
	"qualification" jsonb,
	"date_decision" text,
	"date_notification" text,
	"date_limite" text,
	"date_limite_verifiee" boolean DEFAULT false NOT NULL,
	"avis_prealable" boolean DEFAULT false NOT NULL,
	"avocat_id" text,
	"accepte_le" timestamp with time zone,
	"acceptation_avant" timestamp with time zone,
	"numero_requete" text,
	"dossier_parent_id" text,
	"sharepoint_url" text,
	"source" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dossiers_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "echeances" (
	"id" text PRIMARY KEY NOT NULL,
	"dossier_id" text NOT NULL,
	"type" text NOT NULL,
	"date" text NOT NULL,
	"faite" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evenements_parcours" (
	"id" text PRIMARY KEY NOT NULL,
	"session" text NOT NULL,
	"etape" text NOT NULL,
	"procedure" text,
	"source" text,
	"appareil" text,
	"langue" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indisponibilites" (
	"id" text PRIMARY KEY NOT NULL,
	"avocat_id" text NOT NULL,
	"debut" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone NOT NULL,
	"source" text DEFAULT 'PLATEFORME' NOT NULL,
	"outlook_id" text
);
--> statement-breakpoint
CREATE TABLE "journal" (
	"id" text PRIMARY KEY NOT NULL,
	"dossier_id" text,
	"acteur" text NOT NULL,
	"action" text NOT NULL,
	"details" jsonb,
	"empreinte" text NOT NULL,
	"precedente" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"dossier_id" text NOT NULL,
	"auteur" text NOT NULL,
	"auteur_id" text,
	"contenu" text NOT NULL,
	"affiche_le" timestamp with time zone,
	"lu_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paiements" (
	"id" text PRIMARY KEY NOT NULL,
	"dossier_id" text NOT NULL,
	"stripe_session_id" text,
	"stripe_intent_id" text,
	"moyen" text,
	"montant" integer NOT NULL,
	"lignes" jsonb NOT NULL,
	"par_tiers" boolean DEFAULT false NOT NULL,
	"statut" text NOT NULL,
	"rembourse_montant" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paiements_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "parametres" (
	"cle" text PRIMARY KEY NOT NULL,
	"valeur" jsonb NOT NULL,
	"maj_par" text,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pieces" (
	"id" text PRIMARY KEY NOT NULL,
	"dossier_id" text NOT NULL,
	"type" text NOT NULL,
	"libelle" text NOT NULL,
	"numero" integer,
	"manquante" boolean DEFAULT false NOT NULL,
	"fichiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extraction" jsonb,
	"verifiee" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utilisateurs" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"prenom" text NOT NULL,
	"nom" text NOT NULL,
	"role" "role" NOT NULL,
	"barreau" text DEFAULT 'Paris' NOT NULL,
	"titre" text,
	"photo_url" text,
	"mobile" text,
	"canal_alerte" text DEFAULT 'SMS' NOT NULL,
	"remuneration" "mode_remuneration" DEFAULT 'AUCUNE' NOT NULL,
	"fixe_mensuel_ht" integer,
	"seuil_variable_ht" integer,
	"taux_variable" double precision,
	"validation_associe" boolean DEFAULT false NOT NULL,
	"attribution_ouverte" boolean DEFAULT true NOT NULL,
	"reouverture_le" timestamp with time zone,
	"charte_ia_acceptee_le" timestamp with time zone,
	"entra_id" text,
	"actif" boolean DEFAULT true NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "utilisateurs_email_unique" UNIQUE("email"),
	CONSTRAINT "utilisateurs_entra_id_unique" UNIQUE("entra_id")
);
--> statement-breakpoint
ALTER TABLE "actes" ADD CONSTRAINT "actes_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_acte_id_actes_id_fk" FOREIGN KEY ("acte_id") REFERENCES "public"."actes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_avocat_id_utilisateurs_id_fk" FOREIGN KEY ("avocat_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes_connexion" ADD CONSTRAINT "codes_connexion_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conventions_acceptees" ADD CONSTRAINT "conventions_acceptees_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_avocat_id_utilisateurs_id_fk" FOREIGN KEY ("avocat_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "echeances" ADD CONSTRAINT "echeances_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indisponibilites" ADD CONSTRAINT "indisponibilites_avocat_id_utilisateurs_id_fk" FOREIGN KEY ("avocat_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal" ADD CONSTRAINT "journal_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces" ADD CONSTRAINT "pieces_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE no action ON UPDATE no action;