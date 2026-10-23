// Blog « Actualités » : adresses lisibles, publication contrôlée, rendu du texte.
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { enregistrer, parSlug, publier, publies, slugifier } from "@/lib/serveur/blog";
import { analyser } from "@/app/actualites/Contenu";

const texte = "## Le délai\nLe délai court à compter de la notification.\n\n- premier point\n- **second** point\n\n" + "Information utile. ".repeat(30);

describe("blog", () => {
  it("fabrique des adresses lisibles et uniques", async () => {
    expect(slugifier("Quel délai pour contester une OQTF ?")).toBe("quel-delai-pour-contester-une-oqtf");
    const d = await db();
    const a = await enregistrer(d, "test", { titre: "Article de démonstration", chapo: "Résumé", contenu: texte });
    const b = await enregistrer(d, "test", { titre: "Article de démonstration", chapo: "Résumé", contenu: texte });
    expect(a.ok && b.ok && a.article.slug !== b.article.slug).toBe(true);
  });

  it("refuse de publier un mot interdit, publie un texte conforme", async () => {
    const d = await db();
    const mauvais = await enregistrer(d, "test", { titre: "Une consultation gratuite", chapo: "", contenu: texte });
    expect(mauvais.ok).toBe(true);
    if (!mauvais.ok) return;
    expect((await publier(d, "test", mauvais.article.id, true)).ok).toBe(false);
    const bon = await enregistrer(d, "test", { titre: "Refus de visa : le recours", chapo: "Le recours préalable est obligatoire.", contenu: texte, procedure: "REFUS_VISA" });
    if (!bon.ok) throw new Error("enregistrement");
    expect((await publier(d, "test", bon.article.id, true)).ok).toBe(true);
    expect((await publies(d)).some((x) => x.id === bon.article.id)).toBe(true);
    expect(await parSlug(d, mauvais.article.slug)).toBeNull(); // brouillon invisible sur le site
  });

  it("transforme le texte en intertitres, paragraphes et listes", () => {
    const b = analyser(texte);
    expect(b[0]).toEqual({ type: "h2", texte: "Le délai" });
    expect(b[1].type).toBe("p");
    expect(b[2]).toEqual({ type: "ul", items: ["premier point", "**second** point"] });
  });
});
