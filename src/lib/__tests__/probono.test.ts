import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, prochainCodeClient, prochaineReference, referenceProvisoire, schema } from "@/db";
import { signer } from "@/lib/jeton";
import { accepterProBono, lireProBono, preDossiers, proposerProBono } from "@/lib/serveur/probono";
import type { Membre } from "@/lib/serveur/session";

const membre = async (email: string) => (await (await db()).select().from(schema.utilisateurs).where(eq(schema.utilisateurs.email, email)))[0] as unknown as Membre;

describe("intervention sans honoraires", () => {
  it("un associé propose, le client accepte la convention : dossier pris en charge sans paiement", async () => {
    const d = await db();
    const associe = await membre("rafik.rabia@exemple.invalid");
    const kachi = await membre("boualem.kachi@exemple.invalid");
    const [c] = await d.insert(schema.clients).values({ code: await prochainCodeClient(d), email: "probono@exemple.invalid", prenom: "Samia", nom: "Test", civilite: "MADAME" }).returning();
    const provisoire = referenceProvisoire();
    const [dos] = await d.insert(schema.dossiers).values({ reference: provisoire, referenceProvisoire: provisoire, clientId: c.id, procedure: "OQTF", statut: "PRE_DOSSIER" }).returning();

    expect((await preDossiers(d)).some((x) => x.dos.id === dos.id)).toBe(true);
    // Un avocat non associé ne peut pas décider
    expect((await proposerProBono(d, kachi, dos.reference, kachi.id)).ok).toBe(false);
    expect((await proposerProBono(d, associe, dos.reference, kachi.id)).ok).toBe(true);

    const jeton = signer(dos.id, 24, "probono");
    expect(signer(dos.id, 24, "depot")).not.toBe(jeton);
    const x = await lireProBono(d, jeton);
    expect(x?.texte).toContain("CONVENTION D'INTERVENTION SANS HONORAIRES");
    expect(x?.texte).toContain("sans percevoir d'honoraires");
    expect(x?.texte).not.toMatch(/gratuit|offert/i);
    // Un jeton d'un autre usage ne donne pas accès
    expect(await lireProBono(d, signer(dos.id, 24, "depot"))).toBeNull();

    expect((await accepterProBono(d, jeton, "127.0.0.1", true)).ok).toBe(true);
    const [apres] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, dos.id));
    expect(apres.statut).toBe("PRIS_EN_CHARGE");
    expect(apres.reference).toMatch(/^D\d+$/);
    expect(apres.proBono).toBe(true);
    expect(apres.avocatId).toBe(kachi.id);
    const convs = await d.select().from(schema.conventions).where(eq(schema.conventions.dossierId, dos.id));
    expect(convs.map((v) => v.type)).toEqual(["PRO_BONO"]);
    expect(await d.select().from(schema.paiements).where(eq(schema.paiements.dossierId, dos.id))).toHaveLength(0);
    // Deuxième acceptation sans effet
    expect((await accepterProBono(d, jeton, "127.0.0.1", true)).ok).toBe(true);
    expect(await d.select().from(schema.conventions).where(eq(schema.conventions.dossierId, dos.id))).toHaveLength(1);
  });
});

describe("durée de conservation", () => {
  it("purge un dossier clos depuis plus de 5 ans en gardant les paiements et l'identité de facturation", async () => {
    const { purgerDossiersClos } = await import("@/lib/serveur/conservation");
    const d = await db();
    const [c] = await d.insert(schema.clients).values({ code: await prochainCodeClient(d), email: "ancien@exemple.invalid", telephone: "0600000000", prenom: "Ancien", nom: "Client", adresse: "1 rue X", civilite: "MONSIEUR" }).returning();
    const il6ans = new Date(Date.now() - 6 * 365 * 86_400_000);
    const [dos] = await d.insert(schema.dossiers).values({ reference: await prochaineReference(d), clientId: c.id, procedure: "OQTF", statut: "CLOS", recit: "récit sensible", majLe: il6ans }).returning();
    const [recent] = await d.insert(schema.dossiers).values({ reference: await prochaineReference(d), clientId: c.id, procedure: "OQTF", statut: "CLOS", recit: "récit récent" }).returning();
    await d.insert(schema.messages).values({ dossierId: dos.id, auteur: "CLIENT", contenu: "message" });
    await d.insert(schema.paiements).values({ dossierId: dos.id, montant: 99000, statut: "PAYE", lignes: [] });
    await purgerDossiersClos(d);
    const [apres] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, dos.id));
    expect(apres.recit).toBeNull();
    expect(apres.donneesPurgeesLe).not.toBeNull();
    expect(await d.select().from(schema.messages).where(eq(schema.messages.dossierId, dos.id))).toHaveLength(0);
    expect(await d.select().from(schema.paiements).where(eq(schema.paiements.dossierId, dos.id))).toHaveLength(1);
    const [r] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, recent.id));
    expect(r.recit).toBe("récit récent");
    const [cli] = await d.select().from(schema.clients).where(eq(schema.clients.id, c.id));
    expect(cli.nom).toBe("Client");
    expect(cli.adresse).toBe("1 rue X");
  });
});
