CREATE TABLE "parametres_historique" (
	"id" text PRIMARY KEY NOT NULL,
	"cle" text NOT NULL,
	"avant" jsonb,
	"apres" jsonb NOT NULL,
	"maj_par" text NOT NULL,
	"origine" text DEFAULT 'MANUEL' NOT NULL,
	"motif" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "propositions" (
	"id" text PRIMARY KEY NOT NULL,
	"auteur_id" text NOT NULL,
	"demande" text NOT NULL,
	"resume" text,
	"changements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"alertes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"statut" text DEFAULT 'PROPOSEE' NOT NULL,
	"traitee_par" text,
	"traitee_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "codes_connexion" ALTER COLUMN "client_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "codes_connexion" ADD COLUMN "espace" text DEFAULT 'CLIENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "codes_connexion" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "codes_connexion" ADD COLUMN "utilisateur_id" text;--> statement-breakpoint
ALTER TABLE "propositions" ADD CONSTRAINT "propositions_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes_connexion" ADD CONSTRAINT "codes_connexion_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;