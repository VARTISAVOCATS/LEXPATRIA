import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { activerActeReference, ajouterActeReference, masquer, referencesPour } from "@/lib/serveur/actes-reference";
import { qualiteDe } from "@/lib/equipe";

describe("actes de référence", () => {
  it("masque les identifiants et ne sert que les actes actifs du type demandé", async () => {
    const t = masquer("Monsieur X, né le 12 mars 1990, joignable au 06 12 34 56 78 ou x@exemple.fr, numéro 1234567890.");
    expect(t).not.toMatch(/1990|06 12|exemple\.fr|1234567890/);
    expect(t).toContain("né le XXX");

    const d = await db();
    const [rafik] = await d.select().from(schema.utilisateurs).where(eq(schema.utilisateurs.email, "rafik.rabia@exemple.invalid"));
    const corps = "PLAISE AU TRIBUNAL. ".repeat(30);
    expect((await ajouterActeReference(d, rafik, { code: "REQUETE_OQTF", titre: "Requête type", texte: "trop court" })).ok).toBe(false);
    expect((await ajouterActeReference(d, rafik, { code: "INCONNU", titre: "x", texte: corps })).ok).toBe(false);
    expect((await ajouterActeReference(d, rafik, { code: "REQUETE_OQTF", titre: "Requête type", texte: corps })).ok).toBe(true);
    const refs = await referencesPour(d, "REQUETE_OQTF");
    expect(refs).toHaveLength(1);
    const [a] = await d.select().from(schema.actesReference);
    await activerActeReference(d, rafik, a.id, false);
    expect(await referencesPour(d, "REQUETE_OQTF")).toHaveLength(0);
  });

  it("déduit la qualité d'un membre enregistré avant ce champ", () => {
    expect(qualiteDe({ qualite: null, role: "AVOCAT", remuneration: "A_L_ACTE" })).toBe("SOUS_TRAITANT");
    expect(qualiteDe({ qualite: null, role: "AVOCAT", remuneration: "COLLABORATEUR_FIXE_VARIABLE" })).toBe("COLLABORATEUR");
    expect(qualiteDe({ qualite: "ASSOCIE", role: "ASSOCIE", remuneration: "AUCUNE" })).toBe("ASSOCIE");
  });
});
