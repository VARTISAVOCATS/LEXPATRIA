ALTER TABLE "dossiers" ADD COLUMN "etape_atteinte" text;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "relances_envoyees" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "dossiers" ADD COLUMN "derniere_relance_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "evenements_parcours" ADD COLUMN "motif" text;