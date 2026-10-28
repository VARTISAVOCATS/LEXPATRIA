import Link from "next/link";
import { notFound } from "next/navigation";
import { MISE_A_JOUR, parSlug, RELUE_LE, SITUATIONS, type Bloc } from "@/lib/situations";
import { db } from "@/db";
import { tServeur } from "@/i18n/serveur";
import { BASE, ld, meta } from "@/lib/seo";
import { contenusPublics } from "@/lib/serveur/parametres";
import { EnteteSite } from "../composants/Entete";
import PiedSite from "../composants/PiedSite";
import { BandeFin, Visages } from "../composants/Vitrine";

// Rendu à la demande : les visages des avocats viennent du back office.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ situation: string }> }) {
  const p = parSlug((await params).situation);
  return p ? meta(`${p.titre} — LEXPATRIA Avocats`, p.description, `/${p.slug}`) : {};
}

const dateFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));

function Riche({ t }: { t: string }) {
  return <>{t.split(/(\*\*[^*]+\*\*)/).map((m, i) => (m.startsWith("**") ? <strong key={i}>{m.slice(2, -2)}</strong> : m))}</>;
}

function Blocs({ blocs }: { blocs: Bloc[] }) {
  return (
    <>
      {blocs.map((b, i) =>
        Array.isArray(b) ? (
          <ul key={i}>
            {b.map((x) => (
              <li key={x}>
                <Riche t={x} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <Riche t={b} />
          </p>
        ),
      )}
    </>
  );
}

export default async function Situation({ params }: { params: Promise<{ situation: string }> }) {
  const p = parSlug((await params).situation);
  if (!p) notFound();
  const { t } = await tServeur();
  const { avocats } = await contenusPublics(await db());
  const donnees = {
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${BASE}/${p.slug}`,
        url: `${BASE}/${p.slug}`,
        name: p.titre,
        description: p.description,
        inLanguage: "fr-FR",
        dateModified: MISE_A_JOUR,
        publisher: { "@id": `${BASE}/#cabinet` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
          { "@type": "ListItem", position: 2, name: p.nav, item: `${BASE}/${p.slug}` },
        ],
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(donnees) }} />
      <EnteteSite />
      <main className="acc">
        <section className="acc-hero pg-hero">
          <div className="wrap pg-hero-s">
            <nav className="si-nav pg-pills" aria-label="Vos démarches">
              {SITUATIONS.map((s) => (
                <Link key={s.slug} href={`/${s.slug}`} className={s.slug === p.slug ? "on" : ""}>
                  {s.nav}
                </Link>
              ))}
            </nav>
            <p className="acc-eye">Vos démarches</p>
            <h1>{p.titre}</h1>
            <p className="acc-sub">{p.chapo}</p>
          </div>
        </section>

        <div className="wrap pg-lecture">
          <div className="situ">
            {p.sections.map((s) => (
              <section key={s.titre} className="si-s">
                <h2>{s.titre}</h2>
                <Blocs blocs={s.blocs} />
              </section>
            ))}
            <p className="si-src">
              <b>Textes de référence :</b> {p.textes}
            </p>
            <p className="si-src">
              Information générale, mise à jour le {dateFr(MISE_A_JOUR)}
              {RELUE_LE ? ` et relue par un avocat du cabinet le ${dateFr(RELUE_LE)}` : ""}. Elle ne remplace pas l&apos;examen de votre situation.
            </p>
          </div>
          <aside className="pg-cote">
            <div className="pg-carte">
              <Visages avocats={avocats} petit />
              <h3>Chaque situation est particulière</h3>
              <p>Exposez la vôtre pour connaître la procédure applicable et votre date limite.</p>
              <Link className="btn cta" href="/depot">
                Exposer ma situation
              </Link>
            </div>
          </aside>
        </div>

        <div className="wrap">
          <BandeFin titre={t("Votre décision appelle une réponse dans un délai court")} texte={t("Exposez votre situation en quelques minutes.")} />
          <PiedSite />
        </div>
      </main>
    </>
  );
}
