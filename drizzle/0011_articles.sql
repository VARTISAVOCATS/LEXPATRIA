CREATE TABLE "articles" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"titre" text NOT NULL,
	"chapo" text DEFAULT '' NOT NULL,
	"contenu" text DEFAULT '' NOT NULL,
	"procedure" text,
	"publie" boolean DEFAULT false NOT NULL,
	"publie_le" timestamp with time zone,
	"auteur_id" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
