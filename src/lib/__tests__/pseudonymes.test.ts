import { describe, expect, it } from "vitest";
import { correspondances, pseudonymiser, reidentifier } from "@/lib/pseudonymes";

describe("pseudonymisation de l'identité avant l'IA", () => {
  const c = correspondances({ prenom: "Karim", nom: "Testeur", dateNaissance: "1985-01-01", adresse: "12 rue de la Paix, 93100 Montreuil" });
  const texte = "POUR : Monsieur Karim TESTEUR, né le 01/01/1985, domicilié 12 rue de la Paix, 93100 Montreuil. Monsieur TESTEUR (Testeur) est né le 1er janvier 1985. Tribunal administratif de Montreuil.";

  it("ne laisse aucune donnée d'identité dans le texte envoyé", () => {
    const p = pseudonymiser(texte, c);
    for (const v of ["Karim", "TESTEUR", "Testeur", "01/01/1985", "1er janvier 1985", "12 rue de la Paix"]) expect(p).not.toContain(v);
    expect(p).toContain("Tribunal administratif de Montreuil");
    expect(p).toContain("[PRENOM] [NOM_MAJ]");
  });

  it("restitue exactement le texte d'origine", () => {
    expect(reidentifier(pseudonymiser(texte, c), c)).toBe(texte);
  });

  it("ne remplace pas une partie de mot", () => {
    const c2 = correspondances({ prenom: "Ali", nom: "Ben" });
    expect(pseudonymiser("Alibaba et Ali", c2)).toBe("Alibaba et [PRENOM]");
  });
});
