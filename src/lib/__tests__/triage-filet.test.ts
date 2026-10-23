import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { trier } from "../triage";

function client(reponse: object) {
  return { messages: { create: async () => ({ content: [{ type: "text", text: "```json\n" + JSON.stringify(reponse) + "\n```" }] }) } } as unknown as Anthropic;
}
const base = {
  horsPerimetreMotif: null, situationOQTF: null, detentionOuRetention: false, dateDecision: null, dateNotification: null,
  dateDemande: null, dateEcheance: null, visaType: null, naturalisationIssue: null, emploiMenace: null, prefecture: null,
  nationaliteAlgerienne: null, langue: "fr", faits: [], ceQueLeRecoursPeutObtenir: "", traduction: null,
};

describe("orientation : filet contre le diagnostic par défaut", () => {
  it("« J'ai reçu une OQTF » mène au recours OQTF même si le modèle répond DIAGNOSTIC", async () => {
    const r = await trier({ recit: "J'ai reçu une OQTF" }, client({ ...base, procedure: "DIAGNOSTIC" }));
    expect(r.procedure).toBe("OQTF");
  });
  it("un récit vraiment flou reste en diagnostic", async () => {
    const r = await trier({ recit: "Je ne sais pas quoi faire pour mes papiers" }, client({ ...base, procedure: "DIAGNOSTIC" }));
    expect(r.procedure).toBe("DIAGNOSTIC");
  });
  it("lit une réponse entourée d'un bloc de code", async () => {
    const r = await trier({ recit: "Refus de visa" }, client({ ...base, procedure: "REFUS_VISA" }));
    expect(r.procedure).toBe("REFUS_VISA");
  });
});
