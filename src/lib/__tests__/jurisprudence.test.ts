// Recherche de jurisprudence (PISTE) : authentification, lecture tolérante des réponses Légifrance et Judilibre.
import { afterEach, describe, expect, it, vi } from "vitest";
import { executerOutil, lireArticle, pisteConfiguree, rechercherAdministrative } from "@/lib/serveur/integrations/jurisprudence";

const reponse = (corps: unknown) => new Response(JSON.stringify(corps), { status: 200, headers: { "content-type": "application/json" } });

describe("jurisprudence PISTE", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PISTE_CLIENT_ID;
    delete process.env.PISTE_CLIENT_SECRET;
  });

  it("reste inactive sans identifiants", async () => {
    expect(await pisteConfiguree()).toBe(false);
    expect((await executerOutil("rechercher_jurisprudence_administrative", { requete: "x" })).texte).toMatch(/n'a pas pu répondre/);
  });

  it("obtient un jeton puis lit les résultats Légifrance et un article", async () => {
    process.env.PISTE_CLIENT_ID = "id";
    process.env.PISTE_CLIENT_SECRET = "secret";
    const appels: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        appels.push(url);
        if (url.includes("/oauth/token")) {
          expect(String(init?.body)).toContain("grant_type=client_credentials");
          return reponse({ access_token: "jeton", expires_in: 3600 });
        }
        expect((init?.headers as Record<string, string>).authorization).toBe("Bearer jeton");
        const corps = JSON.parse(String(init?.body ?? "{}"));
        if (url.endsWith("/search") && corps.fond === "CETAT")
          return reponse({ results: [{ titles: [{ id: "CETATEXT000001", title: "Conseil d'État, 10/10/2025, 493118" }], sections: [{ extracts: [{ values: ["<mark>menace</mark> pour l'ordre public"] }] }] }] });
        if (url.endsWith("/search") && corps.fond === "CODE_DATE") return reponse({ results: [{ sections: [{ extracts: [{ id: "LEGIARTI000042771" }] }] }] });
        if (url.endsWith("/consult/getArticle")) return reponse({ article: { num: "R431-12", etat: "VIGUEUR", texteHtml: "<p>L'étranger admis à souscrire une demande…</p>" } });
        return reponse({});
      }),
    );
    const r = await rechercherAdministrative("menace ordre public");
    expect(r[0]).toMatchObject({ id: "CETATEXT000001", titre: "Conseil d'État, 10/10/2025, 493118" });
    expect(r[0].extraits[0]).toBe("menace pour l'ordre public");
    const a = await lireArticle("Code de l'entrée et du séjour des étrangers et du droit d'asile", "R431-12");
    expect(a?.texte).toBe("L'étranger admis à souscrire une demande…");
    expect(a?.lien).toContain("LEGIARTI000042771");
    expect(appels.filter((u) => u.includes("/oauth/token"))).toHaveLength(1); // jeton réutilisé
    expect(appels.every((u) => u.includes("sandbox"))).toBe(true); // bac à sable par défaut
  });
});
