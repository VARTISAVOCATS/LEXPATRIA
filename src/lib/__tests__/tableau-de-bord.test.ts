// Tableau de bord : périmètre (ses dossiers ou vision du cabinet), bandeau des nouveaux dossiers, alertes des associés, secrétariat.
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, prochainCodeClient, prochaineReference, schema } from "@/db";
import { jourParis } from "@/lib/serveur/agenda";
import { ajouterIndisponibilite, tableauDeBord, tableauSecretariat } from "@/lib/serveur/cabinet";
import { voitTout } from "@/lib/serveur/dossiers";

const membre = async (email: string) => (await (await db()).select().from(schema.utilisateurs).where(eq(schema.utilisateurs.email, email)))[0];
const plus = (n: number) => new Date(Date.parse(`${jourParis()}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

async function dossier(valeurs: Partial<typeof schema.dossiers.$inferInsert>) {
  const d = await db();
  const [c] = await d.insert(schema.clients).values({ code: await prochainCodeClient(d), email: `tb-${Math.random()}@exemple.invalid`, prenom: "Sofia", nom: "Test", civilite: "MADAME" }).returning();
  const [dos] = await d.insert(schema.dossiers).values({ reference: await prochaineReference(d), clientId: c.id, procedure: "OQTF", statut: "PAYE", ...valeurs }).returning();
  return dos;
}

describe("tableau de bord", () => {
  it("un avocat ne voit que ses dossiers ; la vision du cabinet s'accorde en back office", async () => {
    const d = await db();
    const kachi = await membre("boualem.kachi@exemple.invalid");
    const khamlichi = await membre("mohamed.khamlichi@exemple.invalid");
    const sien = await dossier({ avocatId: kachi.id, acceptationAvant: new Date(Date.now() + 3_600_000) });
    const autre = await dossier({ avocatId: khamlichi.id, statut: "EN_REDACTION", dateLimite: plus(1) });

    const t = await tableauDeBord(d, kachi, true); // la vision du cabinet est ignorée sans autorisation
    expect(t.cabinet).toBe(false);
    expect(t.nouveaux.map((x) => x.ref)).toContain(sien.reference);
    expect(t.taches.some((x) => x.ref === autre.reference)).toBe(false);
    expect(t.taches.some((x) => x.libelle === "Accepter le dossier")).toBe(false); // porté par le bandeau

    await d.update(schema.utilisateurs).set({ visionCabinet: true }).where(eq(schema.utilisateurs.id, kachi.id));
    const kachi2 = await membre("boualem.kachi@exemple.invalid");
    expect(voitTout(kachi2)).toBe(true);
    const c = await tableauDeBord(d, kachi2, true);
    expect(c.cabinet).toBe(true);
    expect(c.taches.find((x) => x.ref === autre.reference)?.niveau).toBe("URGENT");
    await d.update(schema.utilisateurs).set({ visionCabinet: false }).where(eq(schema.utilisateurs.id, kachi.id));
  });

  it("alerte les associés : dossier sans avocat, échéance pendant une absence", async () => {
    const d = await db();
    const rafik = await membre("rafik.rabia@exemple.invalid");
    const khamlichi = await membre("mohamed.khamlichi@exemple.invalid");
    const orphelin = await dossier({ avocatId: null });
    const pendant = await dossier({ avocatId: khamlichi.id, statut: "PRIS_EN_CHARGE", dateLimite: plus(10) });
    expect((await ajouterIndisponibilite(d, rafik.id, khamlichi.id, plus(9), plus(12), "CONGES")).ok).toBe(true);

    const t = await tableauDeBord(d, rafik, true);
    expect(t.alertes!.sansAvocat.map((x) => x.ref)).toContain(orphelin.reference);
    expect(t.alertes!.pendantAbsence.map((x) => x.ref)).toContain(pendant.reference);
    const ligne = t.equipe!.find((u) => u.nom === "Me Mohamed KHAMLICHI");
    expect(ligne?.absence?.debut).toBe(plus(9));
    expect((await tableauDeBord(d, rafik, false)).alertes).toBeNull();
  });

  it("secrétariat : dépôts transmis classés par date limite et pièces à relancer", async () => {
    const d = await db();
    const kachi = await membre("boualem.kachi@exemple.invalid");
    const tard = await dossier({ avocatId: kachi.id, statut: "ACTE_ATTESTE", transmisSecretariatLe: new Date(), dateLimite: plus(20) });
    const tot = await dossier({ avocatId: kachi.id, statut: "ACTE_ATTESTE", transmisSecretariatLe: new Date(), dateLimite: plus(2) });
    const nonTransmis = await dossier({ avocatId: kachi.id, statut: "ACTE_ATTESTE", dateLimite: plus(1) });
    await d.insert(schema.pieces).values({ dossierId: tard.id, type: "PASSEPORT", libelle: "Passeport", manquante: true });
    const s = await tableauSecretariat(d);
    const refs = s.aDeposer.map((x) => x.ref);
    expect(refs.indexOf(tot.reference)).toBeLessThan(refs.indexOf(tard.reference));
    expect(refs).not.toContain(nonTransmis.reference);
    expect(s.relances.find((x) => x.ref === tard.reference)?.n).toBe(1);
  });
});
