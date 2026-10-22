// Connexions aux API : chiffrement, priorité back office > .env, effacement, aucun secret en clair.
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { EFFACER, enregistrerConnexion, etatConnexions, valeur } from "@/lib/serveur/connexions";

describe("connexions aux API", () => {
  it("chiffre la clé, la fait primer sur le .env, puis rend la main au .env après effacement", async () => {
    const d = await db();
    const [rafik] = await d.select().from(schema.utilisateurs).where(eq(schema.utilisateurs.email, "rafik.rabia@exemple.invalid"));
    process.env.BREVO_API_KEY = "cle-du-fichier-env";
    expect(await valeur("BREVO_API_KEY")).toBe("cle-du-fichier-env");

    expect(await enregistrerConnexion(d, "brevo", { BREVO_API_KEY: "xkeysib-secret-ABCD" }, rafik.id)).toEqual({ ok: true });
    expect(await valeur("BREVO_API_KEY")).toBe("xkeysib-secret-ABCD");

    const [ligne] = await d.select().from(schema.connexions).where(eq(schema.connexions.service, "brevo"));
    expect(ligne.chiffre).not.toContain("secret");
    expect(JSON.stringify(ligne.apercus)).toBe('{"BREVO_API_KEY":"••••ABCD"}');

    const etat = (await etatConnexions(d)).find((c) => c.id === "brevo")!;
    expect(etat.champs[0]).toMatchObject({ source: "back office", apercu: "••••ABCD" });
    expect(JSON.stringify(etat)).not.toContain("xkeysib");

    const journal = await d.select().from(schema.journal).where(eq(schema.journal.action, "CONNEXION_MODIFIEE"));
    expect(JSON.stringify(journal)).not.toContain("xkeysib");

    await enregistrerConnexion(d, "brevo", { BREVO_API_KEY: EFFACER }, rafik.id);
    expect(await valeur("BREVO_API_KEY")).toBe("cle-du-fichier-env");
    delete process.env.BREVO_API_KEY;
  });

  it("refuse un service inconnu et ignore les champs hors catalogue", async () => {
    const d = await db();
    expect((await enregistrerConnexion(d, "inconnu", { X: "y" }, "x")).ok).toBe(false);
    expect((await enregistrerConnexion(d, "stripe", { SECRET_JETONS: "pirate" }, "x")).ok).toBe(false);
    expect(await valeur("SECRET_JETONS")).not.toBe("pirate");
  });
});
