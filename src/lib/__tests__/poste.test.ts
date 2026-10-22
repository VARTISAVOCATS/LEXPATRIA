// Poste de travail : analyse, projet, versions, contrôle croisé, attestation liée à la version exacte, dépôt.
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, prochainCodeClient, prochaineReference, schema } from "@/db";
import { compterManquants, genererModele, modelesPour, motsModifies, tribunalCompetent } from "@/lib/modeles";
import { accepter, changerStatut, fixerDateLimite } from "@/lib/serveur/cabinet";
import {
  analyser,
  attestationValide,
  attester,
  controleCroise,
  dernierActe,
  enregistrerVersion,
  genererProjet,
  signerPriseEnCharge,
  trancher,
  type Analyse,
} from "@/lib/serveur/poste";

const relire = async (id: string) => (await (await db()).select().from(schema.dossiers).where(eq(schema.dossiers.id, id)))[0];

describe("modèles d'actes", () => {
  it("marque XXX tout ce qui manque et nomme le tribunal compétent", () => {
    expect(tribunalCompetent("Préfecture du Val-de-Marne")).toBe("Melun");
    expect(tribunalCompetent("Préfecture de police")).toBe("Paris");
    expect(tribunalCompetent("Préfecture du Rhône")).toBe("XXX");
    const t = genererModele("REQUETE_OQTF", {
      procedure: "OQTF",
      prefecture: "Préfecture du Val-de-Marne",
      reponses: { entree: "2018-01-10", famille: "marie", enfants: "2", scolarises: "oui" },
      avocat: { prenom: "Boualem", nom: "Kachi" },
      pieces: ["Passeport"],
      reference: "D1",
    });
    expect(t.startsWith("TRIBUNAL ADMINISTRATIF DE MELUN")).toBe(true);
    expect(t).toContain("10/01/2018");
    expect(t).toContain("article 3-1 de la convention internationale des droits de l'enfant");
    expect(t).toContain("Maître Boualem Kachi");
    expect(compterManquants(t)).toBeGreaterThan(3);
    expect(t).not.toMatch(/\[[^\]]+\]/); // aucun crochet : uniquement XXX
  });

  it("propose les modèles adaptés à la procédure", () => {
    expect(modelesPour("REFUS_VISA", false)).toEqual(["RAPO_VISA"]);
    expect(modelesPour("OQTF", true)).toEqual(["AVIS_ECRIT"]);
    expect(motsModifies("a b c", "a b d")).toBe(1);
  });
});

describe("parcours du poste de travail jusqu'au dépôt", () => {
  it("n'autorise le dépôt qu'avec une attestation sur la version exacte", async () => {
    const d = await db();
    const [kachi] = await d.select().from(schema.utilisateurs).where(eq(schema.utilisateurs.email, "boualem.kachi@exemple.invalid"));
    const [c] = await d.insert(schema.clients).values({ code: await prochainCodeClient(d), email: "poste@exemple.invalid", prenom: "Samir", nom: "Test", civilite: "MONSIEUR" }).returning();
    const limite = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const [dos0] = await d
      .insert(schema.dossiers)
      .values({ reference: await prochaineReference(d), clientId: c.id, procedure: "OQTF", statut: "PAYE", avocatId: kachi.id, dateLimite: limite, prefecture: "Préfecture du Val-de-Marne" })
      .returning();
    await accepter(d, kachi, dos0);
    await fixerDateLimite(d, kachi, await relire(dos0.id), limite);

    // Analyse et projet
    expect((await analyser(d, kachi, await relire(dos0.id))).ok).toBe(true);
    let dos = await relire(dos0.id);
    const analyse = dos.analyse as Analyse;
    expect(analyse.vigilance.length).toBeGreaterThan(0);
    expect((await genererProjet(d, kachi, dos, "REQUETE_OQTF")).ok).toBe(true);
    expect((await relire(dos.id)).statut).toBe("EN_REDACTION");

    // Contrôle incomplet : XXX restants, points non tranchés → pas d'attestation
    expect((await attester(d, kachi, await relire(dos.id))).ok).toBe(false);

    for (const p of analyse.vigilance) await trancher(d, kachi, await relire(dos.id), p.id, true);
    const acte = (await dernierActe(d, dos.id))!;
    expect((await enregistrerVersion(d, kachi, await relire(dos.id), acte.contenu.replaceAll("XXX", "complété"), 120)).ok).toBe(true);
    const v2 = (await dernierActe(d, dos.id))!;
    expect(v2.version).toBe(2);
    expect(v2.motsModifies).toBeGreaterThan(0);
    expect(v2.tempsRevueS).toBe(120);
    expect((await controleCroise(d, await relire(dos.id))).every((x) => x.ok)).toBe(true);

    // Attestation, puis dépôt possible
    expect((await attester(d, kachi, await relire(dos.id))).ok).toBe(true);
    expect((await relire(dos.id)).statut).toBe("ACTE_ATTESTE");
    expect(await attestationValide(d, v2)).not.toBeNull();

    // Toute modification annule l'attestation et bloque le dépôt
    await enregistrerVersion(d, kachi, await relire(dos.id), v2.contenu + "\nAjout.", 10);
    dos = await relire(dos.id);
    expect(dos.statut).toBe("EN_REDACTION");
    expect(await attestationValide(d, await dernierActe(d, dos.id))).toBeNull();
    expect((await changerStatut(d, kachi, dos, "DEPOSE")).ok).toBe(false);

    // Nouvelle attestation, dépôt accepté
    expect((await attester(d, kachi, dos)).ok).toBe(true);
    expect((await changerStatut(d, kachi, await relire(dos.id), "DEPOSE")).ok).toBe(true);

    // Attestation de prise en charge pour le client
    expect((await signerPriseEnCharge(d, kachi, await relire(dos.id))).ok).toBe(true);
    expect(((await relire(dos.id)).priseEnCharge as { texte: string }).texte).toContain("Maître Boualem Kachi");
    expect((await signerPriseEnCharge(d, kachi, await relire(dos.id))).ok).toBe(false);
  });
});

describe("désignation du préfet", () => {
  it("évite « le préfet de Préfecture du… »", async () => {
    const { prefet } = await import("@/lib/modeles");
    expect(prefet("Préfecture du Val-de-Marne")).toBe("préfet du Val-de-Marne");
    expect(prefet("Préfecture de police")).toBe("préfet de police");
    expect(prefet("Préfecture de la Seine-Saint-Denis")).toBe("préfet de la Seine-Saint-Denis");
    expect(prefet("Préfecture de l'Essonne")).toBe("préfet de l'Essonne");
    expect(prefet("Val-d'Oise")).toBe("préfet de Val-d'Oise");
    expect(prefet(null)).toBe("préfet de XXX");
    expect(prefet("Préfecture du Val-de-Marne", true)).toBe("Préfet du Val-de-Marne");
  });
});

describe("adresses des recours préalables", () => {
  it("reprend les adresses de la CRRV et de la SDANF", () => {
    const base = { procedure: "REFUS_VISA", reponses: {}, avocat: null, pieces: [], reference: "D1" };
    expect(genererModele("RAPO_VISA", base)).toContain("BP 83609\n44036 Nantes Cedex 01");
    expect(genererModele("RAPO_NATURALISATION", { ...base, procedure: "NATURALISATION" })).toContain("12 rue Francis-Le-Carval\n44404 Rezé Cedex");
  });
});
