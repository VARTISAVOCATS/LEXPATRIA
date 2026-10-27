CREATE TABLE "echeancier" (
	"id" text PRIMARY KEY NOT NULL,
	"dossier_id" text NOT NULL,
	"rang" integer NOT NULL,
	"montant" integer NOT NULL,
	"le" text NOT NULL,
	"statut" text DEFAULT 'A_VENIR' NOT NULL,
	"penalite" integer DEFAULT 0 NOT NULL,
	"tentatives" integer DEFAULT 0 NOT NULL,
	"prochaine_tentative" timestamp with time zone,
	"rejete_le" timestamp with time zone,
	"paye_le" timestamp with time zone,
	"intent_id" text,
	"stripe_client_id" text,
	"stripe_moyen_id" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "echeancier" ADD CONSTRAINT "echeancier_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "public"."dossiers"("id") ON DELETE no action ON UPDATE no action;
