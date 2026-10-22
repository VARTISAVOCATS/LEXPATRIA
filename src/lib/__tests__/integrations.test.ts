// Lot 5 : intégrations. Les services externes sont simulés (fetch remplacé) : on vérifie ce que la plateforme envoie.
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db, prochainCodeClient, prochaineReference, schema } from "@/db";
import { empreinteTexte } from "@/lib/journal";
import { genererModele } from "@/lib/modeles";
import { viderCacheConnexions } from "@/lib/serveur/connexions";
import { ajouterPiece } from "@/lib/serveur/dossiers";
import { adresseDepuisActe, envoyerRecommande } from "@/lib/serveur/integrations/maileva";
import { synchroniserAbsences } from "@/lib/serveur/integrations/outlook";
import { facturer, prixHT } from "@/lib/serveur/integrations/pennylane";
import { enregistrerNumero, paquetTelerecours } from "@/lib/serveur/integrations/telerecours";
import { compatible, texteVersPdf } from "@/lib/serveur/pdf";
import { adresseComplete, adresseEnLignes } from "@/lib/pays";
import { texteConvention } from "@/lib/convention";

const membre = async (email: string) => (await (await db()).select().from(schema.utilisateurs).where(eq(schema.utilisateurs.email, email)))[0];
const relire = async (id: string) => (await (await db()).select().from(schema.dossiers).where(eq(schema.dossiers.id, id)))[0];

async function dossierAvecActe(type: "RAPO_VISA" | "REQUETE_REFUS_TITRE", statut: "ACTE_ATTESTE" | "DEPOSE" = "ACTE_ATTESTE") {
  const d = await db();
  const kachi = await membre("boualem.kachi@exemple.invalid");
  const [c] = await d.insert(schema.clients).values({ code: await prochainCodeClient(d), email: `${type.toLowerCase()}@exemple.invalid`, prenom: "Amina", nom: "Test", civilite: "MADAME" }).returning();
  const [dos] = await d
    .insert(schema.dossiers)
    .values({ reference: await prochaineReference(d), clientId: c.id, procedure: type === "RAPO_VISA" ? "REFUS_VISA" : "REFUS_TITRE", statut, avocatId: kachi.id, dateLimite: "2099-01-01", dateLimiteVerifiee: true })
    .returning();
  const contenu = genererModele(type, { procedure: dos.procedure, reponses: {}, avocat: { prenom: "Boualem", nom: "Kachi" }, pieces: [], reference: dos.reference }).replaceAll("XXX", "précisé");
  const [a] = await d.insert(schema.actes).values({ dossierId: dos.id, type, version: 1, contenu }).returning();
  return { dos, acte: a, kachi, contenu };
}
const attester = async (acteId: string, avocatId: string, contenu: string) =>
  (await db()).insert(schema.attestations).values({ acteId, avocatId, version: 1, empreinte: empreinteTexte(contenu), texte: "atteste" });

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ["PENNYLANE_API_KEY", "MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET"]) delete process.env[k];
  viderCacheConnexions();
});

describe("adresse postale", () => {
  it("exige rue, ville, pays et, en France, un code postal à 5 chiffres", () => {
    expect(adresseComplete({ adresse: "12 rue de la Paix", codePostal: "75002", ville: "Paris", pays: "FR" })).toBe(true);
    expect(adresseComplete({ adresse: "12 rue de la Paix", codePostal: "7500", ville: "Paris", pays: "FR" })).toBe(false);
    expect(adresseComplete({ adresse: "Cité 500 logements, bât. B", codePostal: "", ville: "Oran", pays: "DZ" })).toBe(true);
    expect(adresseComplete({ adresse: "", ville: "Oran", pays: "DZ" })).toBe(false);
    expect(adresseEnLignes({ adresse: "Cité 500 logements", codePostal: "31000", ville: "Oran", pays: "DZ" })).toEqual(["Cité 500 logements", "31000 Oran", "ALGÉRIE"]);
    const base = { reference: "D1", procedureLibelle: "Requête", recoursPrealable: false, lignes: [{ diligence: "REQUETE" as const, libelle: "Requête", montant: 99_000 }], troisFois: true };
    expect(texteConvention(base)).toMatch(/Total : 990\s€ TTC\./);
    expect(texteConvention({ ...base, horsUE: true })).toMatch(/Total : 990\s€ \(TVA non applicable, article 259 B du code général des impôts\)\./);
  });
});

describe("PDF", () => {
  it("produit un PDF paginé et remplace les caractères hors du jeu des polices standard", async () => {
    expect(compatible("a ≥ b — « é » œ")).toBe("a >= b — « é » œ");
    const pdf = await PDFDocument.load(await texteVersPdf("Ligne\n".repeat(120), "Essai"));
    expect(pdf.getPageCount()).toBe(3);
  });
});

describe("Maileva", () => {
  it("lit l'adresse du destinataire dans le courrier et n'envoie qu'une version attestée, une seule fois", async () => {
    const d = await db();
    const { dos, acte, kachi, contenu } = await dossierAvecActe("RAPO_VISA");
    const adresse = adresseDepuisActe(contenu);
    expect(adresse.split("\n")[0]).toMatch(/^Commission de recours/);
    expect(adresse).toContain("44036 Nantes Cedex 01");
    expect((await envoyerRecommande(d, kachi, dos, adresse)).ok).toBe(false); // pas encore attesté
    await attester(acte.id, kachi.id, contenu);
    expect(await envoyerRecommande(d, kachi, dos, "XXX")).toEqual({ ok: false, erreur: "Adresse du destinataire incomplète." });
    expect(await envoyerRecommande(d, kachi, dos, adresse)).toEqual({ ok: true, simule: true });
    expect((await relire(dos.id)).statut).toBe("DEPOSE");
    expect((await envoyerRecommande(d, kachi, await relire(dos.id), adresse)).ok).toBe(false);
  });
});

describe("Télérecours", () => {
  it("prépare l'archive de dépôt (requête et pièces numérotées en PDF) puis enregistre le numéro", async () => {
    const d = await db();
    const { dos, acte, kachi, contenu } = await dossierAvecActe("REQUETE_REFUS_TITRE");
    expect((await paquetTelerecours(d, dos)).ok).toBe(false);
    await attester(acte.id, kachi.id, contenu);
    const piece = await PDFDocument.create();
    piece.addPage();
    await ajouterPiece(d, dos, "Décision attaquée", [{ nom: "decision.pdf", mime: "application/pdf", donnees: Buffer.from(await piece.save()) }], "CLIENT");
    const r = await paquetTelerecours(d, dos);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const zip = await JSZip.loadAsync(r.zip);
    expect(Object.keys(zip.files).sort()).toEqual(["Pieces/", "Pieces/1 - Decision attaquee.pdf", `Requete - ${dos.reference}.pdf`]);
    expect((await enregistrerNumero(d, kachi, dos, "2601234", "2026-10-22")).ok).toBe(true);
    const apres = await relire(dos.id);
    expect(apres.statut).toBe("ENREGISTRE");
    expect(apres.numeroRequete).toBe("2601234");
  });
});

describe("Pennylane", () => {
  it("crée le client puis une facture en brouillon, au prix HT avec TVA à 20 %", async () => {
    const d = await db();
    process.env.PENNYLANE_API_KEY = "essai";
    viderCacheConnexions();
    const appels: { url: string; corps: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        appels.push({ url, corps: JSON.parse(String(init.body ?? "{}")) });
        return new Response(JSON.stringify({ id: url.endsWith("individual_customers") ? 77 : 501 }), { status: 201 });
      }),
    );
    const { dos } = await dossierAvecActe("REQUETE_REFUS_TITRE", "DEPOSE");
    const [p] = await d.insert(schema.paiements).values({ dossierId: dos.id, montant: 99_000, lignes: [{ diligence: "REQUETE", libelle: "Requête", montant: 99_000 }], statut: "PAYE" }).returning();
    await facturer(d, p.id);
    expect(appels.map((a) => a.url.split("/v2")[1])).toEqual(["/individual_customers", "/customer_invoices"]);
    const facture = appels[1].corps as { customer_id: number; draft: boolean; invoice_lines: { raw_currency_unit_price: string; vat_rate: string }[] };
    expect(facture.customer_id).toBe(77);
    expect(facture.draft).toBe(true);
    expect(facture.invoice_lines[0]).toMatchObject({ raw_currency_unit_price: "825.00", vat_rate: "FR_200" });
    expect(prixHT(6_900)).toBe("57.50");
    const [apres] = await d.select().from(schema.paiements).where(eq(schema.paiements.id, p.id));
    expect(apres.pennylaneId).toBe("501");
    await facturer(d, p.id); // pas deux fois
    expect(appels.length).toBe(2);

    // Adresse complète : facture finalisée. France : TVA 20 % sur le prix HT ; Algérie : même prix, sans TVA (article 259 B du CGI).
    for (const [pays, codePostal, prix, vat] of [["FR", "75011", "825.00", "FR_200"], ["DZ", "16000", "990.00", "extracom"]] as const) {
      const { dos: autre } = await dossierAvecActe("REQUETE_REFUS_TITRE", "DEPOSE");
      await d.update(schema.clients).set({ adresse: "12 rue de la Paix", codePostal, ville: "Ville", pays, pennylaneId: null }).where(eq(schema.clients.id, autre.clientId));
      const [q] = await d.insert(schema.paiements).values({ dossierId: autre.id, montant: 99_000, lignes: [{ diligence: "REQUETE", libelle: "Requête", montant: 99_000 }], statut: "PAYE" }).returning();
      await facturer(d, q.id);
      const client = appels.at(-2)!.corps as { billing_address: { country: string; postal_code: string } };
      expect(client.billing_address).toMatchObject({ country: pays, postal_code: codePostal });
      const f = appels.at(-1)!.corps as { draft: boolean; invoice_lines: { raw_currency_unit_price: string; vat_rate: string; label: string }[] };
      expect(f.draft).toBe(false);
      expect(f.invoice_lines[0]).toMatchObject({ raw_currency_unit_price: prix, vat_rate: vat });
      expect(f.invoice_lines[0].label.includes("259 B")).toBe(pays === "DZ");
    }
  });
});

describe("Outlook", () => {
  it("importe les absences « Absent du bureau » et retire celles supprimées dans Outlook", async () => {
    const d = await db();
    Object.assign(process.env, { MS_TENANT_ID: "t", MS_CLIENT_ID: "c", MS_CLIENT_SECRET: "s" });
    viderCacheConnexions();
    let evenements = [
      { id: "ev1", showAs: "oof", start: { dateTime: "2099-07-01T00:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2099-07-15T00:00:00.0000000", timeZone: "UTC" } },
      { id: "ev2", showAs: "busy", start: { dateTime: "2099-07-02T09:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2099-07-02T10:00:00.0000000", timeZone: "UTC" } },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("login.microsoftonline.com")
          ? new Response(JSON.stringify({ access_token: "j", expires_in: 3600 }))
          : new Response(JSON.stringify({ value: evenements })),
      ),
    );
    const maintenant = new Date("2099-06-15T00:00:00Z");
    expect(await synchroniserAbsences(d, maintenant)).toBeGreaterThanOrEqual(1);
    const [abs] = await d.select().from(schema.indisponibilites).where(eq(schema.indisponibilites.outlookId, "ev1"));
    expect(abs.source).toBe("OUTLOOK");
    expect(abs.debut.toISOString()).toBe("2099-07-01T00:00:00.000Z");
    evenements = [];
    await synchroniserAbsences(d, maintenant);
    expect(await d.select().from(schema.indisponibilites).where(eq(schema.indisponibilites.outlookId, "ev1"))).toEqual([]);
  });
});
