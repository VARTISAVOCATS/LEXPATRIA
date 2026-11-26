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

describe("open data de la juridiction administrative", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("cherche avec la syntaxe du moteur, filtre par juridiction et lit le texte intégral", async () => {
    const { rechercherOpenData, lireDecisionOpenData, executerOutil: outil } = await import("@/lib/serveur/integrations/jurisprudence");
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        if (url.includes("/elastic/decisions/"))
          return reponse({
            decisions: { body: { hits: { total: { value: 1 }, hits: [{ _id: "DTA_2601827_20261119.xml_TA76", _source: { Nom_Juridiction: "Tribunal Administratif de Rouen", Formation_Jugement: "2 ème Chambre", Numero_Dossier: "2601827", Date_Lecture: "2026-11-19", paragraph: "Vu la procédure suivante :$$$Considérant que…$$$D E C I D E :$$$Article 1er : L'arrêté est annulé." } }] } } },
          });
        return reponse({
          decisions: { body: { hits: { total: { value: 35 }, hits: [{ _id: "DTA_2537854_20261015.xml_TA75", _source: { Nom_Juridiction: "Tribunal Administratif de Paris", Formation_Jugement: "3e Chambre", Numero_Dossier: "2537854", Date_Lecture: "2026-10-15" } }] } } },
        });
      }),
    );
    const r = await rechercherOpenData('+OQTF +"conjoint de nationalité française"', "ta75");
    expect(urls[0]).toContain("/model_search_juri/openData/TA75/");
    expect(urls[0]).toContain(encodeURIComponent('"conjoint de nationalité française"'));
    expect(r[0].titre).toBe("Tribunal Administratif de Paris, 3e Chambre, 15/10/2026, n° 2537854");
    await rechercherOpenData("+OQTF");
    expect(urls[1]).toContain("/Simple_Search/openData/");
    const d = await lireDecisionOpenData("DTA_2601827_20261119.xml_TA76");
    expect(d.texte).toContain("Article 1er : L'arrêté est annulé.");
    expect(d.texte).not.toContain("$$$");
    expect((await outil("lire_decision_ta_caa", { id: "DTA_2601827_20261119.xml_TA76" })).source?.titre).toContain("Rouen");
  });
});

describe("passage exact des décisions retenues", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("n'accepte qu'une citation qui figure mot pour mot dans la décision lue", async () => {
    const { passageExact, rechercherPourActe } = await import("@/lib/serveur/integrations/jurisprudence");
    const texte = "Considérant que M. X… justifie résider en France depuis dix ans avec son épouse, de nationalité française ; que, dans ces conditions, l’arrêté porte une atteinte disproportionnée à son droit au respect de sa vie privée et familiale.";
    expect(passageExact("l'arrêté porte une atteinte disproportionnée à son droit au respect de sa vie privée et familiale", texte)).toBe(true);
    expect(passageExact("l'arrêté méconnaît gravement le droit au respect de la vie privée et familiale", texte)).toBe(false);
    expect(passageExact("trop court", texte)).toBe(false);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        reponse({ decisions: { body: { hits: { hits: [{ _id: "DTA_1_20260101.xml_TA75", _source: { Nom_Juridiction: "Tribunal Administratif de Paris", Numero_Dossier: "1", Date_Lecture: "2026-01-01", paragraph: texte } }] } } } }),
      ),
    );
    const tours = [
      { content: [{ type: "tool_use", id: "t1", name: "lire_decision_ta_caa", input: { id: "DTA_1_20260101.xml_TA75" } }] },
      {
        content: [
          { type: "tool_use", id: "t2", name: "retenir_passage", input: { id: "DTA_1_20260101.xml_TA75", passage: "l'arrêté méconnaît gravement la vie privée" } },
          { type: "tool_use", id: "t3", name: "retenir_passage", input: { id: "DTA_1_20260101.xml_TA75", passage: "« l’arrêté porte une atteinte disproportionnée à son droit au respect de sa vie privée et familiale »" } },
        ],
      },
      { content: [{ type: "text", text: "NOTE DE RECHERCHE : …" }] },
    ];
    const reponses: string[] = [];
    const client = {
      messages: {
        create: vi.fn(async (p: { messages: { content: unknown }[] }) => {
          const dernier = p.messages[p.messages.length - 1].content;
          if (Array.isArray(dernier)) for (const b of dernier as { content?: string }[]) if (typeof b.content === "string") reponses.push(b.content);
          return tours.shift();
        }),
      },
    };
    const r = await rechercherPourActe(client as never, "modele", "contexte");
    expect(reponses.some((x) => x.startsWith("Passage refusé"))).toBe(true);
    expect(reponses).toContain("Passage vérifié et retenu.");
    expect(r?.sources).toHaveLength(1);
    expect(r?.sources[0].passage).toContain("atteinte disproportionnée");
    expect(r?.appels).toBe(1);
  });
});
