ALTER TABLE "dossiers" ADD COLUMN "reference_provisoire" text;--> statement-breakpoint
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_reference_provisoire_unique" UNIQUE("reference_provisoire");
