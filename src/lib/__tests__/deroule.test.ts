import { describe, expect, it } from "vitest";
import { controlerTexte } from "@/lib/deontologie";
import { phrasesSuite, toutesPhrasesSuite } from "@/lib/deroule";
import { traduire } from "@/i18n";

describe("suite de la procédure dans le message de confirmation", () => {
  it("couvre chaque procédure, sans mot interdit ni plaidoirie, et se traduit", () => {
    for (const p of ["OQTF", "REFUS_TITRE", "REFUS_IMPLICITE", "REFUS_VISA", "NATURALISATION", "BLOCAGE_EMPLOI", "BLOCAGE_SIMPLE", "PROCEDURE_EN_COURS", "DIAGNOSTIC"])
      expect(phrasesSuite({ procedure: p, avisPrealable: false }).length, p).toBeGreaterThan(1);
    for (const x of toutesPhrasesSuite()) {
      expect(controlerTexte(x)).toEqual([]);
      expect(x).not.toMatch(/plaid|\bnous\b/i);
      for (const l of ["en", "es", "ar"] as const) expect(traduire(l, x, { delai: "48" }), x).not.toBe(x.replace("{delai}", "48"));
    }
  });

  it("suit le cas reconnu : référé d'emblée, référé-suspension, appel, avis", () => {
    const mu = phrasesSuite({ procedure: "BLOCAGE_EMPLOI", avisPrealable: false, refere: "MESURES_UTILES" }).join(" ");
    expect(mu).toMatch(/juge des référés/);
    expect(mu).not.toMatch(/mise en demeure|employeur|préfecture/);
    expect(phrasesSuite({ procedure: "BLOCAGE_EMPLOI", avisPrealable: false, refere: "LIBERTE" })[0]).toMatch(/référé-liberté/);
    expect(phrasesSuite({ procedure: "REFUS_TITRE", avisPrealable: false, complements: ["REFERE_SUSPENSION_AVEC_REQUETE"] }).join(" ")).toMatch(/suspendre/);
    expect(phrasesSuite({ procedure: "REFUS_TITRE", avisPrealable: false }).join(" ")).not.toMatch(/suspendre/);
    expect(phrasesSuite({ procedure: "PROCEDURE_EN_COURS", avisPrealable: false, cas: "JUGEMENT_DEFAVORABLE" }).join(" ")).toMatch(/appel/);
    expect(phrasesSuite({ procedure: "OQTF", avisPrealable: true })[0]).toMatch(/étudie votre situation/);
  });
});
