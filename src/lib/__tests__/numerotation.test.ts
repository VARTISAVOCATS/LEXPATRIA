import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, prochainCodeClient, referenceProvisoire, schema } from "@/db";
import { marquerPaye } from "@/lib/serveur/paiement";
import { parReference } from "@/lib/serveur/dossiers";

describe("numérotation des dossiers", () => {
  it("le pré-dossier a une référence provisoire ; le numéro Dxxxx est attribué au paiement, sans trou pour les pré-dossiers abandonnés", async () => {
    const d = await db();
    const [c] = await d.insert(schema.clients).values({ code: await prochainCodeClient(d), email: "num@exemple.invalid", prenom: "Nadia", nom: "Numero", civilite: "MADAME" }).returning();
    const creer = async () => {
      const r = referenceProvisoire();
      const [x] = await d.insert(schema.dossiers).values({ reference: r, referenceProvisoire: r, clientId: c.id, procedure: "OQTF", statut: "PRE_DOSSIER" }).returning();
      return x;
    };
    const abandonne = await creer();
    const paye = await creer();
    expect(abandonne.reference).toMatch(/^P[A-Z2-9]{7}$/);
    const [p] = await d.insert(schema.paiements).values({ dossierId: paye.id, montant: 99000, statut: "EN_ATTENTE", lignes: [] }).returning();
    await marquerPaye(d, paye.id, { paiementId: p.id });
    const [apres] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, paye.id));
    expect(apres.reference).toMatch(/^D\d{4,}$/);
    // L'ancien lien (référence provisoire) retrouve toujours le dossier.
    const [parAncien] = await d.select().from(schema.dossiers).where(parReference(paye.reference));
    expect(parAncien.id).toBe(paye.id);
    // Second passage sans effet : le numéro ne change pas.
    await marquerPaye(d, paye.id, { paiementId: p.id });
    const [encore] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, paye.id));
    expect(encore.reference).toBe(apres.reference);
    const [nonPaye] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, abandonne.id));
    expect(nonPaye.reference).toBe(abandonne.reference);
  });
});
