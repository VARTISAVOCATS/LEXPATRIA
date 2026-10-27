// Paiement en trois fois géré par le cabinet : plan, carte, convention, prélèvements (simulés sans Stripe) et pénalité.
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, prochainCodeClient, prochaineReference, schema } from "@/db";
import { texteConvention } from "@/lib/convention";
import { controlerTexte } from "@/lib/deontologie";
import { carteCouvre, ECHEANCIER_DEFAUT, echelonnable, planEcheances } from "@/lib/echeancier";
import { preleverEcheances } from "@/lib/serveur/echeancier";
import { accepterConvention, charger, creerIntention, marquerPaye } from "@/lib/serveur/paiement";

describe("échéancier du cabinet", () => {
  it("calcule 50 / 25 / 25 sur 50 jours, à partir du seuil", () => {
    const p = planEcheances(99_000, ECHEANCIER_DEFAUT, new Date("2026-10-26T10:00:00Z"));
    expect(p.map((e) => e.montant)).toEqual([49_600, 24_700, 24_700]);
    expect(p.map((e) => e.le)).toEqual(["2026-10-26", "2026-11-20", "2026-12-15"]);
    expect(echelonnable(59_000, ECHEANCIER_DEFAUT)).toBe(false);
    expect(echelonnable(60_000, ECHEANCIER_DEFAUT)).toBe(true);
    expect(carteCouvre(12, 2026, "2026-12-15")).toBe(true);
    expect(carteCouvre(11, 2026, "2026-12-15")).toBe(false);
  });

  it("la clause « trois fois sans frais » passe le filtre déontologique", () => {
    const t = texteConvention({
      reference: "D1",
      procedureLibelle: "Recours contre une OQTF",
      recoursPrealable: false,
      lignes: [{ diligence: "REQUETE", libelle: "Requête", montant: 99_000 }],
      echeancier: planEcheances(99_000, ECHEANCIER_DEFAUT),
      regles: ECHEANCIER_DEFAUT,
    });
    expect(t).toContain("trois fois sans frais");
    expect(t).toContain("pénalité forfaitaire de 15 €");
    expect(controlerTexte(t)).toEqual([]);
    expect(controlerTexte("Consultation sans frais")).not.toEqual([]);
  });

  it("règle la première échéance, prélève les suivantes à leur date et applique la pénalité après le délai", async () => {
    const d = await db();
    const [c] = await d
      .insert(schema.clients)
      .values({ code: await prochainCodeClient(d), email: "trois@exemple.invalid", prenom: "Sami", nom: "Test", civilite: "MONSIEUR", telephone: "0600000000", adresse: "1 rue de Rivoli", codePostal: "75001", ville: "Paris", pays: "FR" })
      .returning();
    const [dos] = await d.insert(schema.dossiers).values({ reference: await prochaineReference(d), clientId: c.id, procedure: "OQTF", traitement: "NORMAL" }).returning();
    const x = (await charger(d, dos.id))!;
    await accepterConvention(d, x.dos, x.cli, "127.0.0.1");
    const i = await creerIntention(d, x.dos, x.cli, false, "ECHEANCIER");
    expect("simulation" in i && i.simulation && i.total).toBe(49_600);
    if ("simulation" in i && i.simulation) await marquerPaye(d, dos.id, { paiementId: i.paiementId, moyen: "simulation" });
    const lignes = async () => d.select().from(schema.echeancier).where(eq(schema.echeancier.dossierId, dos.id)).orderBy(schema.echeancier.rang);
    expect((await lignes()).map((e) => e.statut)).toEqual(["PAYE", "A_VENIR", "A_VENIR"]);

    // Rien n'est prélevé avant la date ; la 2e échéance l'est à sa date.
    expect((await preleverEcheances(d, new Date())).echeancesPrelevees).toBe(0);
    const e2 = (await lignes())[1];
    await preleverEcheances(d, new Date(`${e2.le}T09:00:00Z`));
    expect((await lignes()).map((e) => e.statut)).toEqual(["PAYE", "PAYE", "A_VENIR"]);
    const regles = await d.select().from(schema.paiements).where(and(eq(schema.paiements.dossierId, dos.id), eq(schema.paiements.statut, "PAYE")));
    expect(regles.map((p) => p.montant).sort()).toEqual([24_700, 49_600]);

    // 3e échéance rejetée il y a 9 jours, non régularisée : pénalité de 15 €, une seule fois.
    const e3 = (await lignes())[2];
    const maintenant = new Date(`${e3.le}T09:00:00Z`);
    await d
      .update(schema.echeancier)
      .set({ statut: "ECHEC", tentatives: 3, rejeteLe: new Date(maintenant.getTime() - 9 * 86_400_000) })
      .where(eq(schema.echeancier.id, e3.id));
    expect((await preleverEcheances(d, maintenant)).penalites).toBe(1);
    expect((await lignes())[2].penalite).toBe(1_500);
    expect((await preleverEcheances(d, maintenant)).penalites).toBe(0);
  });
});
