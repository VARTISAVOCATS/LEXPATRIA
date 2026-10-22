// Lot 3, étape 3 : espace appel (proposition, avenant, règlement, retour à l'avocat) et indicateurs.
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, prochainCodeClient, prochaineReference, schema } from "@/db";
import { genererModele, modelesPour } from "@/lib/modeles";
import { appelDe, delaiAppelEstime, proposerAppel, renoncerAppel } from "@/lib/serveur/appel";
import { accepter, changerStatut } from "@/lib/serveur/cabinet";
import { indicateurs } from "@/lib/serveur/indicateurs";
import { ecrireParametre } from "@/lib/serveur/parametres";
import { accepterConvention, charger, creerIntention, marquerPaye, offre } from "@/lib/serveur/paiement";

const membre = async (email: string) => (await (await db()).select().from(schema.utilisateurs).where(eq(schema.utilisateurs.email, email)))[0];
const relire = async (id: string) => (await (await db()).select().from(schema.dossiers).where(eq(schema.dossiers.id, id)))[0];
const jPlus = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function jugement(email: string, statut: "JUGE" | "PRIS_EN_CHARGE" = "JUGE") {
  const d = await db();
  const kachi = await membre("boualem.kachi@exemple.invalid");
  const [c] = await d.insert(schema.clients).values({ code: await prochainCodeClient(d), email, prenom: "Yanis", nom: "Test", civilite: "MONSIEUR" }).returning();
  const [dos] = await d
    .insert(schema.dossiers)
    .values({ reference: await prochaineReference(d), clientId: c.id, procedure: "REFUS_TITRE", statut, avocatId: kachi.id, prefecture: "Préfecture du Val-de-Marne", tribunal: "Melun", numeroRequete: "2601234" })
    .returning();
  return dos;
}

describe("délai d'appel", () => {
  it("un mois en matière d'OQTF, deux mois sinon", () => {
    expect(delaiAppelEstime("OQTF", "2026-10-31")).toBe("2026-11-30");
    expect(delaiAppelEstime("REFUS_TITRE", "2026-10-15")).toBe("2026-12-15");
  });
});

describe("espace appel", () => {
  it("propose l'appel, fait accepter l'avenant et revient à l'avocat de la première instance", async () => {
    const d = await db();
    const kachi = await membre("boualem.kachi@exemple.invalid");
    const parent = await jugement("appel@exemple.invalid");
    const message = "Le tribunal a écarté à tort votre insertion professionnelle ; l'appel me paraît sérieux.";
    expect((await proposerAppel(d, kachi, await jugement("encours@exemple.invalid", "PRIS_EN_CHARGE"), { dateJugement: jPlus(-10), dateNotification: jPlus(-5), message })).ok).toBe(false);
    expect((await proposerAppel(d, kachi, parent, { dateJugement: jPlus(-10), dateNotification: jPlus(-5), message: "XXX" })).ok).toBe(false);
    const r = await proposerAppel(d, kachi, parent, { dateJugement: jPlus(-10), dateNotification: jPlus(-5), message });
    expect(r.ok).toBe(true);
    expect((await proposerAppel(d, kachi, parent, { dateJugement: jPlus(-10), dateNotification: jPlus(-5), message })).ok).toBe(false); // pas deux fois

    let a = (await appelDe(d, parent.id))!;
    expect(a.statut).toBe("APPEL_PROPOSE");
    expect(a.cour).toBe("Paris");
    expect(a.avocatId).toBe(kachi.id);
    expect(a.dateLimiteVerifiee).toBe(false);
    const msgs = await d.select().from(schema.messages).where(eq(schema.messages.dossierId, parent.id));
    expect(msgs.at(-1)?.contenu).toContain(a.reference);
    expect((await changerStatut(d, kachi, a, "EN_REDACTION")).ok).toBe(false);

    // Offre : forfait d'appel seul ; avenant archivé.
    expect((await offre(d, a)).lignes.map((l) => l.diligence)).toEqual(["APPEL"]);
    const c = (await charger(d, a.id))!;
    await accepterConvention(d, c.dos, c.cli, "127.0.0.1");
    const [conv] = await d.select().from(schema.conventions).where(eq(schema.conventions.dossierId, a.id));
    expect(conv.type).toBe("AVENANT_APPEL");
    expect(conv.texte).toContain("AVENANT D'APPEL");
    expect(conv.texte).toContain(parent.reference);

    const i = await creerIntention(d, c.dos, c.cli, false);
    expect(i.simulation).toBe(true);
    if (i.simulation) await marquerPaye(d, a.id, { paiementId: i.paiementId, moyen: "simulation" });
    a = await relire(a.id);
    expect(a.statut).toBe("PAYE");
    expect(a.avocatId).toBe(kachi.id); // pas de réattribution
    expect(a.acceptationAvant).not.toBeNull();
    expect((await accepter(d, kachi, a)).ok).toBe(true);

    // Poste de travail : requête d'appel devant la bonne cour.
    expect(modelesPour(a.procedure, false, true)[0]).toBe("REQUETE_APPEL");
    const t = genererModele("REQUETE_APPEL", {
      procedure: "REFUS_TITRE",
      prefecture: "Préfecture du Val-de-Marne",
      reponses: {},
      avocat: { prenom: "Boualem", nom: "Kachi" },
      pieces: [],
      reference: a.reference,
      dateDecision: "2026-10-01",
      dateNotification: "2026-10-05",
      appel: { tribunal: "Melun", numero: "2601234", referencePremiere: parent.reference },
    });
    expect(t.startsWith("COUR ADMINISTRATIVE D'APPEL DE PARIS")).toBe(true);
    expect(t).toContain("jugement n° 2601234 du tribunal administratif de Melun du 01/10/2026");
  });

  it("le client peut renoncer à l'appel, sans frais", async () => {
    const d = await db();
    const kachi = await membre("boualem.kachi@exemple.invalid");
    const parent = await jugement("renonce@exemple.invalid");
    await proposerAppel(d, kachi, parent, { dateJugement: jPlus(-3), dateNotification: jPlus(-2), message: "Je vous propose d'interjeter appel de ce jugement." });
    const a = (await appelDe(d, parent.id))!;
    expect((await renoncerAppel(d, a)).ok).toBe(true);
    expect((await relire(a.id)).statut).toBe("CLOS");
    expect((await renoncerAppel(d, await relire(a.id))).ok).toBe(false);
  });
});

describe("indicateurs", () => {
  it("calcule les règlements, la prise en charge sous 48 heures et la base de rémunération", async () => {
    const d = await db();
    const x = await indicateurs(d, "30");
    expect(x.dossiersPayes).toBeGreaterThanOrEqual(1);
    expect(x.encaisse).toBeGreaterThanOrEqual(129_000);
    expect(x.tauxSous48h).toBe(1);
    expect(x.parProcedure.some(([c]) => c === "APPEL")).toBe(true);
    const kachi = x.parAvocat.find((a) => a.nom === "Boualem Kachi")!;
    expect(kachi.recus).toBeGreaterThanOrEqual(1);
    expect(kachi.acceptesSous48h).toBe(kachi.acceptes);
  });

  it("rémunère à l'acte : un acte compte une fois, hors avis écrits, au tarif du back office", async () => {
    const d = await db();
    const kachi = await membre("boualem.kachi@exemple.invalid");
    const rafik = await membre("rafik.rabia@exemple.invalid");
    await d.update(schema.utilisateurs).set({ remuneration: "A_L_ACTE" }).where(eq(schema.utilisateurs.id, kachi.id));
    const dos = await jugement("acte@exemple.invalid", "PRIS_EN_CHARGE");
    for (const [type, version] of [["REQUETE_REFUS_TITRE", 1], ["REQUETE_REFUS_TITRE", 2], ["AVIS_ECRIT", 1]] as const) {
      const [a] = await d.insert(schema.actes).values({ dossierId: dos.id, type, version, contenu: "x" }).returning();
      await d.insert(schema.attestations).values({ acteId: a.id, avocatId: kachi.id, version, empreinte: "e", texte: "t" });
    }
    const avant = (await indicateurs(d, "30")).parAvocat.find((a) => a.id === kachi.id)!;
    expect(avant.actesRemunerables).toBe(1);
    expect(avant.montantActesHT).toBe(20_000);
    expect((await ecrireParametre(d, "remuneration", { acteHT: 25_000 }, rafik.id)).ok).toBe(true);
    expect((await indicateurs(d, "30")).parAvocat.find((a) => a.id === kachi.id)!.montantActesHT).toBe(25_000);
  });
});
