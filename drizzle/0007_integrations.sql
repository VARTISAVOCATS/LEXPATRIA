CREATE TABLE "archives" (
	"id" text PRIMARY KEY NOT NULL,
	"dossier_id" text NOT NULL,
	"cle" text NOT NULL,
	"chemin" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "envois" (
	"id" text PRIMARY KEY NOT NULL,
	"dossier_id" text NOT NULL,
	"acte_id" text NOT NULL,
	"prestataire" text DEFAULT 'MAILEVA' NOT NULL,
	"id_externe" text,
	"statut" text NOT NULL,
	"destinataire" text NOT NULL,
	"par" text NOT NULL,
	"message" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "synchronisations" (
	"service" text PRIMARY KEY NOT NULL,
	"le" timestamp with time zone NOT NULL,
	"ok" boolean NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "pennylane_id" text;--> statement-breakpoint
ALTER TABLE "echeances" ADD COLUMN "outlook_id" text;--> statement-breakpoint
ALTER TABLE "paiements" ADD COLUMN "pennylane_id" text;--> statement-breakpoint
ALTER TABLE "paiements" ADD COLUMN "pennylane_erreur" text;--> statement-breakpoint
ALTER TABLE "archives" ADD CONSTRAINT "archives_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envois" ADD CONSTRAINT "envois_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envois" ADD CONSTRAINT "envois_acte_id_actes_id_fk" FOREIGN KEY ("acte_id") REFERENCES "public"."actes"("id") ON DELETE no action ON UPDATE no action;