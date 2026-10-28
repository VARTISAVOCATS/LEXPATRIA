// Blog « Actualités » : liste des articles publiés.
import Link from "next/link";
import { db } from "@/db";
import { publies } from "@/lib/serveur/blog";
import { EnteteSite } from "../composants/Entete";
import { Bandeau } from "../composants/Vitrine";
import PiedSite from "../composants/PiedSite";
import AppelAction from "./AppelAction";
import { dateFr } from "./Contenu";

export const metadata = {
  title: "Actualités du droit des étrangers — LEXPATRIA Avocats",
  description: "OQTF, titre de séjour, visa, naturalisation : les articles du cabinet pour comprendre vos droits et les délais pour agir.",
  alternates: { canonical: "/actualites" },
  openGraph: { title: "Actualités du droit des étrangers — LEXPATRIA Avocats", url: "/actualites", type: "website", images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
};

export default async function Actualites() {
  const liste = await publies(await db());
  return (
    <>
      <EnteteSite />
      <main className="acc">
        <Bandeau
          surtitre="Actualités"
          titre="Comprendre vos droits"
          chapo="OQTF, refus de titre ou de visa, préfecture sans réponse : délais et recours."
        />
        <div className="wrap art">
          {liste.length === 0 ? (
            <p className="acc-lead pg-vide">Les premiers articles arrivent bientôt.</p>
          ) : (
            <ul className="art-liste pg-articles">
              {liste.map((a) => (
                <li key={a.id}>
                  <Link href={`/actualites/${a.slug}`}>
                    {a.publieLe && <time dateTime={a.publieLe.toISOString()}>{dateFr(a.publieLe)}</time>}
                    <h2>{a.titre}</h2>
                    {a.chapo && <p>{a.chapo}</p>}
                    <span className="pg-lire">Lire l&apos;article →</span>
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
