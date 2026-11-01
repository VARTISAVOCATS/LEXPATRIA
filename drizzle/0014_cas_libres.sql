CREATE TABLE "cas_libres" (
	"id" text PRIMARY KEY NOT NULL,
	"libelle" text NOT NULL,
	"procedure" text NOT NULL,
	"fiche" jsonb NOT NULL,
	"traite" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
