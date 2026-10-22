// Lots 2 à 4 : connexion par code, paramètres modifiables avec retour arrière, assistant, contrôles de l'espace cabinet.
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, prochainCodeClient, prochaineReference, schema } from "@/db";
import { decider, proposer } from "@/lib/serveur/assistant";
import { accepter, changerStatut, fixerDateLimite } from "@/lib/serveur/cabinet";
import { demanderCode, verifierCode } from "@/lib/serveur/connexion";
import { accesClient, accesEquipe } from "@/lib/serveur/dossiers";
import { controler, ecrireParametre, historique, lireParametre, restaurer } from "@/lib/serveur/parametres";

async function membre(email: string) {
  const d = await db();
  const [u] = await d.select().from(schema.utilisateurs).where(eq(schema.utilisateurs.email, email));
  return u;
}

async function dossierPaye(email: string, avocatEmail: string) {
  const d = await db();
  const [c] = await d.insert(schema.clients).values({ code: await prochainCodeClient(d), email, prenom: "Karim", nom: "TEST" }).returning();
  const av = await membre(avocatEmail);
  const [dos] = await d
    .insert(schema.dossiers)
    .values({ reference: await prochaineReference(d), clientId: c.id, procedure: "OQTF", statut: "PAYE", avocatId: av.id, dateLimite: "2026-11-15" })
    .returning();
  return dos;
}

describe("paramètres du back office", () => {
  it("refuse un terme interdit et un format invalide", () => {
    const faq = controler("faq", [{ q: "Est-ce payant ?", r: "La première consultation est gratuite." }]);
    expect(faq.ok).toBe(false);
    expect(faq.infractions[0].motif).toBe("gratuit");
    expect(controler("tarifs", { REQUETE: -5 }).ok).toBe(false);
    expect(controler("inconnu", 1).ok).toBe(false);
  });

  it("enregistre, historise et revient en arrière", async () => {
    const d = await db();
    const rafik = await membre("rafik.rabia@exemple.invalid");
    const avant = await lireParametre(d, "tarifs");
    expect(avant.REQUETE).toBe(99_000);
    const r = await ecrireParametre(d, "tarifs", { ...avant, REQUETE: 109_000 }, rafik.id);
    expect(r.ok).toBe(true);
    expect((await lireParametre(d, "tarifs")).REQUETE).toBe(109_000);
    const [h] = await historique(d, "tarifs");
    expect(await restaurer(d, h.id, rafik.id)).toMatchObject({ ok: true });
    expect((await lireParametre(d, "tarifs")).REQUETE).toBe(99_000);
    expect((await historique(d, "tarifs")).length).toBe(2);
  });
});

describe("connexion par code", () => {
  it("n'envoie de code qu'à un client ayant un dossier payé, et vérifie le code une seule fois", async () => {
    const d = await db();
    expect(await demanderCode(d, "CLIENT", "inconnu@exemple.invalid")).toEqual({});
    await dossierPaye("Client.Un@Exemple.invalid", "boualem.kachi@exemple.invalid");
    const { codeEssai } = await demanderCode(d, "CLIENT", "client.un@exemple.invalid");
    expect(codeEssai).toMatch(/^\d{6}$/);
    expect(await verifierCode(d, "CLIENT", "client.un@exemple.invalid", "000000" === codeEssai ? "111111" : "000000")).toBeNull();
    expect(await verifierCode(d, "CLIENT", "client.un@exemple.invalid", codeEssai!)).toBe("client.un@exemple.invalid");
    expect(await verifierCode(d, "CLIENT", "client.un@exemple.invalid", codeEssai!)).toBeNull(); // usage unique
  });

  it("bloque après 5 essais", async () => {
    const d = await db();
    const { codeEssai } = await demanderCode(d, "EQUIPE", "mohamed.khamlichi@exemple.invalid");
    const faux = codeEssai === "999999" ? "888888" : "999999";
    for (let i = 0; i < 5; i++) expect(await verifierCode(d, "EQUIPE", "mohamed.khamlichi@exemple.invalid", faux)).toBeNull();
    expect(await verifierCode(d, "EQUIPE", "mohamed.khamlichi@exemple.invalid", codeEssai!)).toBeNull();
  });

  it("ne stocke que l'empreinte du code", async () => {
    const d = await db();
    const { codeEssai } = await demanderCode(d, "EQUIPE", "ahlem.benabderrazak@exemple.invalid");
    const lignes = await d.select().from(schema.codesConnexion).where(eq(schema.codesConnexion.email, "ahlem.benabderrazak@exemple.invalid"));
    expect(lignes[0].empreinte).toBe(createHash("sha256").update(codeEssai!).digest("hex"));
  });
});

describe("droits et contrôles de l'espace cabinet", () => {
  it("un client ne voit que ses dossiers ; un avocat, ceux qui lui sont attribués", async () => {
    const d = await db();
    const dos = await dossierPaye("client.deux@exemple.invalid", "boualem.kachi@exemple.invalid");
    expect(await accesClient(d, "client.deux@exemple.invalid", dos.reference)).not.toBeNull();
    expect(await accesClient(d, "autre@exemple.invalid", dos.reference)).toBeNull();
    expect(await accesEquipe(d, await membre("boualem.kachi@exemple.invalid"), dos.reference)).not.toBeNull();
    expect(await accesEquipe(d, await membre("mohamed.khamlichi@exemple.invalid"), dos.reference)).toBeNull();
    expect(await accesEquipe(d, await membre("rafik.rabia@exemple.invalid"), dos.reference)).not.toBeNull();
  });

  it("aucun dépôt avant la vérification de la date limite par l'avocat", async () => {
    const d = await db();
    const kachi = await membre("boualem.kachi@exemple.invalid");
    let dos = await dossierPaye("client.trois@exemple.invalid", "boualem.kachi@exemple.invalid");
    expect((await changerStatut(d, kachi, dos, "EN_REDACTION")).ok).toBe(false); // accepter d'abord
    expect((await accepter(d, kachi, dos)).ok).toBe(true);
    [dos] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, dos.id));
    expect(await changerStatut(d, kachi, dos, "DEPOSE")).toEqual({ ok: false, erreur: "Vérifiez et fixez d'abord la date limite du recours." });
    expect((await fixerDateLimite(d, kachi, dos, "2026-11-14")).ok).toBe(true);
    [dos] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, dos.id));
    expect(dos.dateLimiteVerifiee).toBe(true);
    // Date vérifiée mais acte non attesté : toujours pas de dépôt.
    expect(await changerStatut(d, kachi, dos, "DEPOSE")).toEqual({ ok: false, erreur: "Aucun dépôt sans attestation de l'avocat sur la dernière version de l'acte." });
  });
});

describe("assistant du back office (sans clé : compréhension simulée)", () => {
  it("prépare un changement de prix, l'applique seulement après validation", async () => {
    const d = await db();
    const rafik = await membre("rafik.rabia@exemple.invalid");
    const p = await proposer(d, rafik.id, "Passe le recours OQTF à 1090 euros");
    expect(p.statut).toBe("PROPOSEE");
    expect((await lireParametre(d, "tarifs")).REQUETE).toBe(99_000); // rien n'est appliqué
    expect(await decider(d, rafik.id, p.id, true)).toEqual({ ok: true });
    expect((await lireParametre(d, "tarifs")).REQUETE).toBe(109_000);
    expect((await decider(d, rafik.id, p.id, true)).ok).toBe(false); // pas deux fois
    const [h] = await historique(d, "tarifs");
    expect(h.origine).toBe("ASSISTANT");
    await restaurer(d, h.id, rafik.id);
  });

  it("classe une demande de nouvel écran en évolution du site", async () => {
    const d = await db();
    const rafik = await membre("rafik.rabia@exemple.invalid");
    const p = await proposer(d, rafik.id, "Ajoute une nouvelle page pour les étudiants");
    expect(p.statut).toBe("EVOLUTION");
    expect((await decider(d, rafik.id, p.id, true)).ok).toBe(false);
  });
});
