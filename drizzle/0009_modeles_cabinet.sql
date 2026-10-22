CREATE TABLE "modeles_cabinet" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"version" integer NOT NULL,
	"texte" text NOT NULL,
	"fichier" text,
	"auteur_id" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
