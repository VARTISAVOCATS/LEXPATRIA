ALTER TABLE "dossiers" ADD COLUMN "avis_transmis_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "echeances" ADD COLUMN "rappel_le" text;--> statement-breakpoint
ALTER TABLE "indisponibilites" ADD COLUMN "motif" text DEFAULT 'CONGES' NOT NULL;