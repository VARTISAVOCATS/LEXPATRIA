import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, prochainCodeClient, prochaineReference, schema } from "@/db";
import { relancer } from "@/lib/serveur/relances";

describe("relances des pré-dossiers", () => {
  it("relance à 2 h puis à 24 h, sauf désinscription, et purge à 30 jours", async () => {
    const d = await db();
    const H = 3_600_000;
    const maintenant = new Date("2026-10-20T12:00:00Z");
    const creer = async (consent: boolean, ilYaH: number) => {
      const [c] = await d
        .insert(schema.clients)
        .values({ code: await prochainCodeClient(d), email: "x@exemple.fr", telephone: "0612345678", consentRelances: consent })
        .returning();
      const [dos] = await d
        .insert(schema.dossiers)
        .values({ reference: await prochaineReference(d), clientId: c.id, procedure: "OQTF", creeLe: new Date(maintenant.getTime() - ilYaH * H) })
        .returning();
      await d.insert(schema.journal).values({ dossierId: dos.id, acteur: "CLIENT", action: "PRE_DOSSIER_CREE", empreinte: "x" });
      return dos.id;
    };
    const a = await creer(true, 3);
    const b = await creer(false, 3);
    const c = await creer(true, 1);
    const vieux = await creer(false, 24 * 31);

    const r1 = await relancer(d, maintenant);
    expect(r1.envoyees).toBe(1);
    expect(r1.purges).toBe(1);
    const lire = async (id: string) => (await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, id)))[0];
    expect((await lire(a)).relancesEnvoyees).toBe(1);
    expect((await lire(b)).relancesEnvoyees).toBe(0);
    expect((await lire(c)).relancesEnvoyees).toBe(0);
    expect(await lire(vieux)).toBeUndefined();

    const r2 = await relancer(d, new Date(maintenant.getTime() + 22 * H));
    expect(r2.envoyees).toBe(2); // a (24 h) et c (2 h)
    expect((await lire(a)).relancesEnvoyees).toBe(2);
    const r3 = await relancer(d, new Date(maintenant.getTime() + 60 * H));
    expect((await lire(a)).relancesEnvoyees).toBe(2); // jamais plus de deux
    expect(r3.envoyees).toBe(1); // c, seconde relance
  });
});
