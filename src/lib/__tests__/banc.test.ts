// Banc d'essai de l'orientation : vingt récits types et les réponses qu'un modèle Sonnet a données à la consigne de production.
// Toute modification de la consigne ou du traitement doit conserver ces orientations (procédure et cas attendus).
import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import banc from "./banc/reponses.json";
import { trier } from "../triage";

const ATTENDU: [string, string | null][] = [
  ["BLOCAGE_SIMPLE", "NATURALISATION_SANS_SUITE"],
  ["OQTF", "OQTF_GENERALE"],
  ["REFUS_TITRE", "REFUS_RENOUVELLEMENT"],
  ["BLOCAGE_EMPLOI", "DOCUMENTS_RETENUS"],
  ["BLOCAGE_SIMPLE", "RENDEZ_VOUS_IMPOSSIBLE"],
  ["BLOCAGE_EMPLOI", "BLOCAGE_ATTEINTE_GRAVE"],
  ["REFUS_VISA", "VISA_CONJOINT_FRANCAIS"],
  ["NATURALISATION", "NATURALISATION_AJOURNEMENT"],
  ["PROCEDURE_EN_COURS", "RECOURS_EN_COURS"],
  ["HORS_PERIMETRE", null],
  ["OQTF", "OQTF_GENERALE"], // rétention : écran de refus (situation RETENTION)
  ["HORS_PERIMETRE", null],
  ["REFUS_IMPLICITE", "SILENCE_DEMANDE_TITRE"],
  ["DIAGNOSTIC", null], // récit vague : question de précision
  ["OQTF", "OQTF_REFUS_TITRE"],
  ["NATURALISATION", "NATURALISATION_REJET_IMPLICITE"],
  ["BLOCAGE_SIMPLE", "TITRE_NON_REMIS"],
  ["OQTF", "OQTF_REFUS_TITRE"],
  ["REFUS_VISA", "VISA_REFUS_IMPLICITE"],
  ["OQTF", "OQTF_ASSIGNATION"],
];

describe("banc d'essai de l'orientation", () => {
  banc.forEach((b, i) => {
    it(`#${i} ${b.recit.slice(0, 60)}`, async () => {
      const client = { messages: { create: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(b.reponse) }] }) } } as unknown as Anthropic;
      const r = await trier({ recit: b.recit }, client);
      expect([r.procedure, r.cas]).toEqual(ATTENDU[i]);
      if (r.procedure !== "HORS_PERIMETRE") expect(r.noteClient.length).toBeGreaterThan(40);
    });
  });
  it("le récit vague donne une question, la rétention l'écran de rétention", async () => {
    const c = (i: number) => ({ messages: { create: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(banc[i].reponse) }] }) } }) as unknown as Anthropic;
    expect((await trier({ recit: banc[13].recit }, c(13))).question).not.toBeNull();
    expect((await trier({ recit: banc[10].recit }, c(10))).situationOQTF).toBe("RETENTION");
  });
});
