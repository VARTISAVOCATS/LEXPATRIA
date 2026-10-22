ALTER TABLE "actes" ADD COLUMN "texte_ia" text;--> statement-breakpoint
ALTER TABLE "actes" ADD COLUMN "auteur_id" text;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "analyse" jsonb;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "prise_en_charge" jsonb;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "transmis_secretariat_le" timestamp with time zone;