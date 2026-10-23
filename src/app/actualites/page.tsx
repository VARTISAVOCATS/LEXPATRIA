// Blog « Actualités » : liste des articles publiés.
import Link from "next/link";
import { db } from "@/db";
import { publies } from "@/lib/serveur/blog";
import { EnteteSite } from "../composants/Entete";
import PiedSite from "../composants/PiedSite";
import AppelAction from "./AppelAction";
import { dateFr } from "./Contenu";

export const metadata = {
  title: "Actualités du droit des étrangers — LEXPATRIA Avocats",
  description: "OQTF, titre de séjour, visa, naturalisation : nos articles pour comprendre vos droits et les délais pour agir.",
  alternates: { canonical: "/actualites" },
};

export default async function Actualites() {
  const liste = await publies(await db());
  return (
    <>
      <EnteteSite />
      <main>
        <div className="wrap art" style={{ maxWidth: 820 }}>
          <div className="eyebrow">Actualités</div>
          <h1>Comprendre vos droits</h1>
          <p className="serif art-chapo">Des réponses claires aux questions que posent une OQTF, un refus de titre ou de visa, une préfecture qui ne répond pas.</p>
          {liste.length === 0 ? (
            <p className="note">Les premiers articles arrivent bientôt.</p>
          ) : (
            <ul className="art-liste">
              {liste.map((a) => (
                <li key={a.id}>
                  <Link href={`/actualites/${a.slug}`}>
                    <h2>{a.titre}</h2>
                    {a.chapo && <p>{a.chapo}</p>}
                    {a.publieLe && <time dateTime={a.publieLe.toISOString()}>{dateFr(a.publieLe)}</time>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <AppelAction />
          <PiedSite />
        </div>
      </main>
    </>
  );
}
