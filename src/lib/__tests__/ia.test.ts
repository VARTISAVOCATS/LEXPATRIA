import { describe, expect, it } from "vitest";
import { listeTolerante, messageErreurIA } from "@/lib/ia";

describe("appels à l'IA", () => {
  it("les listes mal formées sont lues sans échec", () => {
    expect(listeTolerante("un point", 8)).toEqual(["un point"]);
    expect(listeTolerante(["a", "", 3, "b"], 1)).toEqual(["a"]);
    expect(listeTolerante(undefined, 8)).toEqual([]);
  });
  it("la cause d'un échec est donnée à l'avocat", () => {
    expect(messageErreurIA({ status: 400, error: { error: { message: "Your credit balance is too low to access the Anthropic API." } } })).toMatch(/Crédit/);
    expect(messageErreurIA({ status: 401, message: "invalid x-api-key" })).toMatch(/Clé Anthropic/);
    expect(messageErreurIA({ status: 529 })).toMatch(/surchargé/);
    expect(messageErreurIA(new SyntaxError("Unexpected end"))).toMatch(/n'a pas répondu/);
  });
});

import { accorder, genererModele } from "@/lib/modeles";
describe("accord des actes", () => {
  it("accorde le projet au genre de la personne", () => {
    expect(accorder("Il/elle est né(e), ressortissant(e) algérien(ne) ; l'intéressé(e)", "MADAME")).toBe("Elle est née, ressortissante algérienne ; l'intéressée");
    expect(accorder("il/elle est entré(e)", "MONSIEUR")).toBe("il est entré");
    const t = genererModele("REQUETE_OQTF", {
      civilite: "MADAME", prenom: "Zaina", nom: "Test", procedure: "OQTF", avocat: null, pieces: ["La décision contestée (toutes les pages)"], reference: "D1",
      reponses: { entree: "2020-09-14", famille: "marie", conjoint: "regulier", enfants: "3", scolarises: "oui", activite: "cdi", anciennete: "1a3" },
    });
    expect(t).not.toMatch(/\(e\)|il\/elle|1a3|conjoint regulier/i);
    expect(t).toContain("depuis un à trois ans");
    expect(t).toContain("3 enfants, scolarisés en France");
    expect(t.match(/Pièce n° \d/g)).toHaveLength(3); // en-tête, rappel des faits et bordereau
    expect(t).toContain("À l'honneur de vous exposer");
    expect(t).toContain("À titre subsidiaire");
  });
});


describe("pièces médicales", () => {
  it("ne sont jamais transmises à l'IA", async () => {
    const { estPieceMedicale } = await import("@/lib/serveur/poste");
    expect(estPieceMedicale({ type: "DEMANDEE", libelle: "Certificat médical du néphrologue" })).toBe(true);
    expect(estPieceMedicale({ type: "AUTRE", libelle: "Carte mobilité inclusion (handicap)" })).toBe(true);
    expect(estPieceMedicale({ type: "MEDICAL", libelle: "Pièce" })).toBe(true);
    expect(estPieceMedicale({ type: "SALAIRES", libelle: "Trois derniers bulletins de salaire" })).toBe(false);
    expect(estPieceMedicale({ type: "DECISION", libelle: "La décision contestée (toutes les pages)" })).toBe(false);
  });
});

describe("mise en forme des actes", () => {
  it("reconnaît la présentation du cabinet et produit Word et PDF", async () => {
    const { mettreEnForme } = await import("@/lib/miseEnForme");
    const { acteVersDocx } = await import("@/lib/serveur/docx-acte");
    const { actePdf } = await import("@/lib/serveur/pdf");
    const texte = "À : Monsieur le Président du tribunal administratif de Melun.\n\nREQUÊTE EN ANNULATION\n(article R. 421-1 du code de justice administrative)\n\nPOUR : Monsieur Karim EXEMPLE, né le XXX.\n\nCONTRE : La décision du 30/04/2026.\n\nPièce n° 1 : Décision attaquée\n\nÀ l'honneur de vous exposer\n\nI. RAPPEL DES FAITS\n\nTexte « cité ».\n\nPAR CES MOTIFS\n\n— Annuler la décision ;\n\nFait à Paris, le XXX\n\nMaître Rafik Rabia\n\nBORDEREAU DES PIÈCES\nPièce n° 1 : Décision attaquée";
    const f = mettreEnForme(texte);
    expect(f.titre).toBe("REQUÊTE EN ANNULATION");
    expect(f.sousTitre).toBe("article R. 421-1 du code de justice administrative");
    expect(f.blocs.find((b) => b.morceaux[0].texte === "Pièce n° 1 : Décision attaquée")?.align).toBe("droite");
    expect(f.blocs.find((b) => b.morceaux.some((m) => m.texte === "Maître Rafik Rabia"))?.align).toBe("droite");
    expect(f.blocs.find((b) => b.morceaux.some((m) => m.texte === "« cité »"))?.morceaux.find((m) => m.texte === "« cité »")?.italique).toBe(true);
    expect((await acteVersDocx(texte)).subarray(0, 2).toString()).toBe("PK");
    expect(Buffer.from(await actePdf(texte)).subarray(0, 4).toString()).toBe("%PDF");
    // Un courrier n'a ni titre encadré ni intitulés centrés.
    expect(mettreEnForme("MINISTÈRE DE L'INTÉRIEUR\nObjet : recours").titre).toBeNull();
  });
});
