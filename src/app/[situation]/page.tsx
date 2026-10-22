import Link from "next/link";
import { notFound } from "next/navigation";
import { MISE_A_JOUR, parSlug, RELUE_LE, SITUATIONS, type Bloc } from "@/lib/situations";
import { EnteteSite } from "../composants/Entete";
import PiedSite from "../composants/PiedSite";

export const dynamicParams = false;
export function generateStaticParams() {
  return SITUATIONS.map((s) => ({ situation: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ situation: string }> }) {
  const p = parSlug((await params).situation);
  return p ? { title: `${p.titre} — LEXPATRIA Avocats`, description: p.description } : {};
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
  return (
    <>
      <EnteteSite />
      <main>
        <div className="wrap situ" style={{ maxWidth: 780 }}>
          <nav className="si-nav" aria-label="Vos démarches">
            {SITUATIONS.map((s) => (
              <Link key={s.slug} href={`/${s.slug}`} className={s.slug === p.slug ? "on" : ""}>
                {s.nav}
              </Link>
            ))}
          </nav>
          <div className="eyebrow">Vos démarches</div>
          <h1>{p.titre}</h1>
          <p className="serif si-chapo">{p.chapo}</p>
          {p.sections.map((s) => (
            <section key={s.titre} className="si-s">
              <h2>{s.titre}</h2>
              <Blocs blocs={s.blocs} />
            </section>
          ))}
          <div className="si-cta">
            <p>
              Chaque situation est particulière. Vous pouvez nous exposer la vôtre : la procédure applicable et votre date limite vous sont
              indiquées, puis un avocat du cabinet étudie votre dossier.
            </p>
            <Link className="btn cta" href="/depot">
              Exposer ma situation
            </Link>
          </div>
          <p className="si-src">
            <b>Textes de référence :</b> {p.textes}
          </p>
          <p className="si-src">
            Information générale, mise à jour le {dateFr(MISE_A_JOUR)}
            {RELUE_LE ? ` et relue par un avocat du cabinet le ${dateFr(RELUE_LE)}` : ""}. Elle ne remplace pas l&apos;examen de votre situation.
          </p>
          <PiedSite />
        </div>
      </main>
    </>
  );
}
