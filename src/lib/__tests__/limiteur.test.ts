import { describe, expect, it } from "vitest";
import { autoriser, ipDe } from "@/lib/serveur/limiteur";

describe("limitation des appels publics", () => {
  it("bloque au-delà du plafond, par adresse", () => {
    for (let i = 0; i < 3; i++) expect(autoriser("essai:1.2.3.4", 3, 60_000)).toBe(true);
    expect(autoriser("essai:1.2.3.4", 3, 60_000)).toBe(false);
    expect(autoriser("essai:5.6.7.8", 3, 60_000)).toBe(true);
    expect(ipDe(new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } }))).toBe("9.9.9.9");
  });
});
