CREATE TABLE "connexions" (
	"service" text PRIMARY KEY NOT NULL,
	"chiffre" text NOT NULL,
	"apercus" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"maj_par" text NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	"test_le" timestamp with time zone,
	"test_ok" boolean,
	"test_message" text
);
