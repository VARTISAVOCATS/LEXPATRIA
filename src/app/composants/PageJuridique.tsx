// Pages juridiques (mentions légales, politique de confidentialité) : texte en français, sections titrées.
// Les informations encore manquantes sont écrites XXX et surlignées en jaune jusqu'à ce qu'elles soient complétées.
import type { ReactNode } from "react";
import { EnteteSite } from "./Entete";
import PiedSite from "./PiedSite";
import { Bandeau } from "./Vitrine";

export interface SectionJuridique {
  titre: string;
  paragraphes: (string | string[])[]; // une chaîne = un paragraphe ; un tableau = une liste
}

function Texte({ t }: { t: string }): ReactNode {
  return t.split(/(XXX)/).map((m, i) => (m === "XXX" ? <mark key={i} className="jur-xxx">XXX</mark> : m));
}

export default function PageJuridique({ surtitre, titre, chapo, sections, maj }: { surtitre: string; titre: string; chapo?: string; sections: SectionJuridique[]; maj: string }) {
  return (
    <>
      <EnteteSite />
      <main className="acc">
        <Bandeau surtitre={surtitre} titre={titre} chapo={chapo} />
        <div className="wrap pg-lecture pg-juridique">
          <div className="situ">
            {sections.map((s) => (
              <section key={s.titre} className="si-s">
                <h2>{s.titre}</h2>
                {s.paragraphes.map((p, i) =>
                  Array.isArray(p) ? (
                    <ul key={i}>
                      {p.map((l) => (
                        <li key={l}>
                          <Texte t={l} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i}>
                      <Texte t={p} />
                    </p>
                  ),
                )}
              </section>
            ))}
            <p className="si-src">Dernière mise à jour : {maj}.</p>
          </div>
        </div>
        <div className="wrap">
          <PiedSite />
        </div>
      </main>
    </>
  );
}
