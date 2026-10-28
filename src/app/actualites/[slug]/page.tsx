// Article du blog : contenu, données structurées (référencement) et invitation à agir en fin d'article.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { parSlug, publies } from "@/lib/serveur/blog";
import { EnteteSite } from "../../composants/Entete";
import PiedSite from "../../composants/PiedSite";
import AppelAction from "../AppelAction";
import Contenu, { dateFr } from "../Contenu";

const base = process.env.URL_PUBLIQUE ?? "https://lexpatria.fr";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const a = await parSlug(await db(), (await params).slug);
  if (!a) return { title: "Article introuvable — LEXPATRIA Avocats" };
  return {
    title: `${a.titre} — LEXPATRIA Avocats`,
    description: a.chapo,
    alternates: { canonical: `/actualites/${a.slug}` },
    openGraph: { title: a.titre, description: a.chapo, type: "article", url: `${base}/actualites/${a.slug}`, publishedTime: a.publieLe?.toISOString(), images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const d = await db();
  const a = await parSlug(d, (await params).slug);
  if (!a) notFound();
  const autres = (await publies(d)).filter((x) => x.id !== a.id).slice(0, 3);
  const donnees = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: a.titre,
        description: a.chapo,
        datePublished: a.publieLe?.toISOString(),
        dateModified: a.majLe.toISOString(),
        inLanguage: "fr",
        mainEntityOfPage: `${base}/actualites/${a.slug}`,
        author: { "@type": "Organization", name: "LEXPATRIA Avocats" },
        publisher: { "@type": "LegalService", name: "LEXPATRIA Avocats", url: base },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: base },
          { "@type": "ListItem", position: 2, name: "Actualités", item: `${base}/actualites` },
          { "@type": "ListItem", position: 3, name: a.titre, item: `${base}/actualites/${a.slug}` },
        ],
      },
    ],
  };
  return (
    <>
      <EnteteSite />
      <main className="acc">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees).replace(/</g, "\\u003c") }} />
        <header className="acc-hero pg-hero">
          <div className="wrap pg-hero-s pg-art-h">
            <nav className="art-fil" aria-label="Fil d'Ariane">
              <Link href="/actualites">Actualités</Link>
            </nav>
            <h1>{a.titre}</h1>
            {a.publieLe && <time className="art-date" dateTime={a.publieLe.toISOString()}>{dateFr(a.publieLe)}</time>}
            {a.chapo && <p className="acc-sub">{a.chapo}</p>}
          </div>
        </header>
        <article className="wrap art pg-art">
          <Contenu texte={a.contenu} />
          <p className="art-mention">Information générale. Elle ne remplace pas l&apos;examen de votre situation par un avocat.</p>
          <AppelAction />
          {autres.length > 0 && (
            <section className="art-autres">
              <h2>À lire aussi</h2>
              <ul>
                {autres.map((x) => (
                  <li key={x.id}>
                    <Link href={`/actualites/${x.slug}`}>{x.titre}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <PiedSite />
        </article>
      </main>
    </>
  );
}
