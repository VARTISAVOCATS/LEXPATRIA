import { describe, expect, it } from "vitest";
import { calculerTaches, type DossierTache } from "@/lib/taches";

const base: DossierTache = { ref: "D1", client: "A B", procedure: "OQTF", statut: "EN_REDACTION", urgence: false, avis: false, dateLimite: null, acceptationAvant: null, transmis: false, avocat: "Me X", piecesAVerifier: 0, piecesManquantes: 0, messagesNonLus: 0 };
const J = "2026-11-18";

describe("Ma journée", () => {
  it("classe par urgence sans doublon de la date limite", () => {
    const t = calculerTaches(
      [
        { ...base, ref: "D1", dateLimite: "2026-11-19" },
        { ...base, ref: "D2", dateLimite: "2026-11-24", statut: "PRIS_EN_CHARGE" },
        { ...base, ref: "D3", dateLimite: "2026-12-20", statut: "ACTE_ATTESTE" },
        { ...base, ref: "D4", statut: "INSTRUCTION", messagesNonLus: 2 },
      ],
      [
        { ref: "D1", type: "DATE_LIMITE", date: "2026-11-19" },
        { ref: "D4", type: "AUDIENCE", date: "2026-11-17" },
      ],
      [],
      "AVOCAT",
      J,
    );
    expect(t.filter((x) => x.ref === "D1")).toHaveLength(1);
    expect(t.find((x) => x.ref === "D1")!.niveau).toBe("URGENT");
    expect(t.find((x) => x.ref === "D4" && x.libelle === "Audience")!.niveau).toBe("URGENT");
    expect(t.find((x) => x.ref === "D2")!.niveau).toBe("SEMAINE");
    expect(t.find((x) => x.ref === "D3")!.libelle).toBe("Transmettre au secrétariat pour le dépôt");
    expect(t.find((x) => x.ref === "D3")!.niveau).toBe("SUIVI");
    expect(t[0].niveau).toBe("URGENT");
  });

  it("un dossier payé en urgence reste prioritaire jusqu'au dépôt", () => {
    const t = calculerTaches([{ ...base, urgence: true, dateLimite: "2026-12-30" }], [], [], "AVOCAT", J);
    expect(t[0].niveau).toBe("URGENT");
  });

  it("le secrétariat ne voit que le dépôt, les messages, les relances et les audiences", () => {
    const t = calculerTaches(
      [
        { ...base, ref: "D1", statut: "ACTE_ATTESTE", transmis: true, dateLimite: "2026-11-25" },
        { ...base, ref: "D2", statut: "EN_REDACTION", piecesManquantes: 1 },
      ],
      [],
      [],
      "SECRETARIAT",
      J,
    );
    expect(t.map((x) => x.libelle)).toEqual(["Déposer le recours", "Relancer le client : une pièce manquante"]);
  });
});
