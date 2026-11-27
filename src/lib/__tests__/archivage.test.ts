import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, prochainCodeClient, prochaineReference, schema } from "@/db";
import { archiver } from "@/lib/serveur/cabinet";
import { compteurs, dossiersEquipe } from "@/lib/serveur/dossiers";
import type { Membre } from "@/lib/serveur/session";

const membre = async (email: string) => (await (await db()).select().from(schema.utilisateurs).where(eq(schema.utilisateurs.email, email)))[0] as unknown as Membre;

describe("archivage des dossiers", () => {
  it("archive puis désarchive : le dossier passe des listes à l'onglet Archivés et revient", async () => {
    const d = await db();
    const associe = await membre("rafik.rabia@exemple.invalid");
    const kachi = await membre("boualem.kachi@exemple.invalid");
    const [c] = await d.insert(schema.clients).values({ code: await prochainCodeClient(d), email: "archive@exemple.invalid", prenom: "Ali", nom: "Archive", civilite: "MONSIEUR" }).returning();
    const [dos] = await d.insert(schema.dossiers).values({ reference: await prochaineReference(d), clientId: c.id, procedure: "OQTF", statut: "EN_REDACTION", avocatId: associe.id }).returning();
    const avant = await compteurs(d, associe);

    // Un avocat qui n'est pas celui du dossier ne peut pas l'archiver
    expect((await archiver(d, kachi, dos, true)).ok).toBe(false);
    expect((await archiver(d, associe, dos, true)).ok).toBe(true);
    const [arch] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, dos.id));
    expect(arch.archiveLe).not.toBeNull();
    expect((await dossiersEquipe(d, associe, "tous")).some((x) => x.dos.id === dos.id)).toBe(false);
    expect((await dossiersEquipe(d, associe, "archives")).some((x) => x.dos.id === dos.id)).toBe(true);
    const pendant = await compteurs(d, associe);
    expect(pendant.enCours).toBe(avant.enCours - 1);
    expect(pendant.archives).toBe(avant.archives + 1);

    expect((await archiver(d, associe, arch, false)).ok).toBe(true);
    expect((await dossiersEquipe(d, associe, "en_cours")).some((x) => x.dos.id === dos.id)).toBe(true);
    expect((await compteurs(d, associe)).archives).toBe(avant.archives);
  });
});
