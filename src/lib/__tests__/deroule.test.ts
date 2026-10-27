import { describe, expect, it } from "vitest";
import { controlerTexte } from "@/lib/deontologie";
import { DEROULE, etapesDeroule } from "@/lib/deroule";
import { traduire } from "@/i18n";

describe("déroulé envoyé après paiement", () => {
  it("couvre chaque procédure, sans mot interdit ni plaidoirie, et se traduit", () => {
    for (const p of ["OQTF", "REFUS_TITRE", "REFUS_IMPLICITE", "REFUS_VISA", "NATURALISATION", "BLOCAGE_EMPLOI", "BLOCAGE_SIMPLE", "PROCEDURE_EN_COURS", "DIAGNOSTIC"]) {
      const e = etapesDeroule(p, false);
      expect(e.length).toBeGreaterThan(2);
      for (const x of e) {
        expect(controlerTexte(x)).toEqual([]);
        expect(x).not.toMatch(/plaid/i);
        for (const l of ["en", "es", "ar"] as const) expect(traduire(l, x, { delai: "48" })).not.toBe(x.replace("{delai}", "48"));
      }
    }
    expect(etapesDeroule("OQTF", true)[0]).toBe(DEROULE.DIAGNOSTIC![0]);
  });
});
