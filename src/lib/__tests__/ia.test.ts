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
