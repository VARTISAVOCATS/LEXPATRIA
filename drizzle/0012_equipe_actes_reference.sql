ALTER TABLE "utilisateurs" ADD COLUMN "qualite" text;--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD COLUMN "acte_ht" integer;--> statement-breakpoint
ALTER TABLE "utilisateurs" ADD COLUMN "avis_ht" integer;--> statement-breakpoint
UPDATE "utilisateurs" SET "qualite" = CASE
  WHEN "role" = 'ASSOCIE' THEN 'ASSOCIE'
  WHEN "role" = 'SECRETARIAT' THEN 'SECRETARIAT'
  WHEN "role" = 'CONFRERE_LOCAL' THEN 'CONFRERE_LOCAL'
  WHEN "remuneration" = 'A_L_ACTE' THEN 'SOUS_TRAITANT'
  ELSE 'COLLABORATEUR' END;--> statement-breakpoint
CREATE TABLE "actes_reference" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"titre" text NOT NULL,
	"texte" text NOT NULL,
	"fichier" text,
	"actif" boolean DEFAULT true NOT NULL,
	"auteur_id" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
