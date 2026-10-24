// Lot 3, étape 2 : agenda, rappels d'échéance, absences et attribution, questions des clients, consultations.
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, prochainCodeClient, prochaineReference, schema } from "@/db";
import { agenda, avisDuClient, consultations, echeanceAvis, jourParis, proposerReponse, questionsEnAttente, rappelerEcheances, transmettreAvis } from "@/lib/serveur/agenda";
import { attribuer } from "@/lib/serveur/attribution";
import { accepter, ajouterEcheance, ajouterIndisponibilite } from "@/lib/serveur/cabinet";
import { ajouterMessage } from "@/lib/serveur/dossiers";
import { attester, enregistrerVersion, genererProjet } from "@/lib/serveur/poste";

const membre = async (email: string) => (await (await db()).select().from(schema.utilisateurs).where(eq(schema.utilisateurs.email, email)))[0];
const relire = async (id: string) => (await (await db()).select().from(schema.dossiers).where(eq(schema.dossiers.id, id)))[0];

async function dossier(email: string, valeurs: Partial<typeof schema.dossiers.$inferInsert> = {}) {
  const d = await db();
  const kachi = await membre("boualem.kachi@exemple.invalid");
  const [c] = await d.insert(schema.clients).values({ code: await prochainCodeClient(d), email, prenom: "Nadia", nom: "Test", civilite: "MADAME" }).returning();
  const [dos] = await d
    .insert(schema.dossiers)
    .values({ reference: await prochaineReference(d), clientId: c.id, procedure: "OQTF", statut: "PAYE", avocatId: kachi.id, ...valeurs })
    .returning();
  return dos;
}

describe("agenda et rappels", () => {
  it("classe les échéances et n'envoie qu'un rappel par jour, la veille puis le jour", async () => {
    const d = await db();
    const kachi = await membre("boualem.kachi@exemple.invalid");
    let dos = await dossier("agenda@exemple.invalid");
    await accepter(d, kachi, dos);
    dos = await relire(dos.id);
    const auj = jourParis();
    // Lendemain calendaire (robuste au changement d'heure, où une journée compte 23 ou 25 heures).
    const demain = new Date(Date.parse(`${auj}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    await ajouterEcheance(d, kachi, dos, "AUDIENCE", demain);
    await ajouterEcheance(d, kachi, dos, "MEMOIRE_COMPLEMENTAIRE", "2020-01-01");
    const a = await agenda(d, kachi);
    expect(a.retard.some((e) => e.reference === dos.reference && e.libelle === "Mémoire complémentaire")).toBe(true);
    expect(a.semaine.some((e) => e.reference === dos.reference && e.libelle === "Audience")).toBe(true);

    expect((await rappelerEcheances(d)).rappels).toBeGreaterThanOrEqual(1);
    expect((await rappelerEcheances(d)).rappels).toBe(0); // déjà rappelé aujourd'hui
    const [e] = await d.select().from(schema.echeances).where(eq(schema.echeances.date, demain));
    expect(e.rappelLe).toBe(auj);
    // Le lendemain, l'échéance du jour est rappelée une seconde fois.
    expect((await rappelerEcheances(d, new Date(`${demain}T10:00:00Z`))).rappels).toBeGreaterThanOrEqual(1);
  });

  it("n'attribue pas de dossier à un avocat qui part dans moins de 2 jours ouvrés", async () => {
    const d = await db();
    const rafik = await membre("rafik.rabia@exemple.invalid");
    const avocats = (await d.select().from(schema.utilisateurs)).filter((u) => u.role === "AVOCAT" && u.actif);
    const auj = jourParis();
    // Lendemain calendaire (robuste au changement d'heure, où une journée compte 23 ou 25 heures).
    const demain = new Date(Date.parse(`${auj}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    for (const u of avocats) expect((await ajouterIndisponibilite(d, rafik.id, u.id, demain, "2099-12-31", "FORMATION")).ok).toBe(true);
    const dos = await dossier("attrib@exemple.invalid", { avocatId: null });
    const choisi = await attribuer(d, dos.id, false);
    expect(choisi?.role).toBe("ASSOCIE"); // les collaborateurs partent bientôt : un associé reçoit le dossier
    expect((await ajouterIndisponibilite(d, rafik.id, avocats[0].id, demain, demain, "INCONNU")).ok).toBe(false);
    await d.delete(schema.indisponibilites);
  });
});

describe("questions des clients", () => {
  it("liste les dossiers dont le dernier message vient du client et propose une trame avec XXX", async () => {
    const d = await db();
    const kachi = await membre("boualem.kachi@exemple.invalid");
    const dos = await dossier("question@exemple.invalid");
    await ajouterMessage(d, dos, "CLIENT", null, "Bonjour, où en est mon dossier ?");
    expect((await questionsEnAttente(d, kachi)).some((q) => q.dos.id === dos.id)).toBe(true);
    const r = await proposerReponse(d, kachi, dos);
    expect(r.ok && r.texte.includes("XXX") && r.texte.includes("Maître Boualem Kachi")).toBe(true);
    await ajouterMessage(d, dos, "AVOCAT", kachi.id, "Bonjour, votre requête est en préparation.");
    expect((await questionsEnAttente(d, kachi)).some((q) => q.dos.id === dos.id)).toBe(false);
    expect((await proposerReponse(d, kachi, dos)).ok).toBe(false);
  });
});

describe("consultations", () => {
  it("fixe l'échéance à 48 heures ouvrées et ne transmet qu'un avis attesté", async () => {
    const d = await db();
    const kachi = await membre("boualem.kachi@exemple.invalid");
    // Lundi 2 novembre 2026, 10 h à Paris (UTC+1), journées de 9 h à 19 h : 9 + 10 + 10 + 10 + 9 heures → vendredi 6 novembre, 18 h.
    expect(echeanceAvis(new Date("2026-11-02T09:00:00Z")).toISOString()).toBe("2026-11-06T17:00:00.000Z");

    let dos = await dossier("avis@exemple.invalid", { avisPrealable: true });
    await d.insert(schema.paiements).values({ dossierId: dos.id, montant: 6_900, lignes: [], statut: "PAYE" });
    await accepter(d, kachi, dos);
    dos = await relire(dos.id);
    const [x] = (await consultations(d, kachi, "a_rendre")).filter((c) => c.dos.id === dos.id);
    expect(x.rendreAvant).not.toBeNull();
    expect((await transmettreAvis(d, kachi, dos)).ok).toBe(false); // pas encore d'avis

    expect((await genererProjet(d, kachi, dos, "AVIS_ECRIT")).ok).toBe(true);
    dos = await relire(dos.id);
    const [acte] = await d.select().from(schema.actes).where(eq(schema.actes.dossierId, dos.id));
    expect((await enregistrerVersion(d, kachi, dos, acte.contenu.replaceAll("XXX", "précisé"), 120)).ok).toBe(true);
    expect(await transmettreAvis(d, kachi, dos)).toEqual({ ok: false, erreur: "Attestez d'abord la dernière version de l'avis." });
    expect(await attester(d, kachi, await relire(dos.id))).toEqual({ ok: true }); // pas de date limite exigée pour un avis
    expect(await avisDuClient(d, await relire(dos.id))).toBeNull(); // rien de visible avant transmission
    expect(await transmettreAvis(d, kachi, await relire(dos.id))).toEqual({ ok: true });
    dos = await relire(dos.id);
    expect(dos.statut).toBe("CLOS");
    expect((await avisDuClient(d, dos))?.texte).toContain("précisé");
    expect((await consultations(d, kachi, "transmis")).some((c) => c.dos.id === dos.id)).toBe(true);
  });
});
