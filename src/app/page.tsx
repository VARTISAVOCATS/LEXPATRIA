import Link from "next/link";
import { db } from "@/db";
import { contenusPublics } from "@/lib/serveur/parametres";
import { publies } from "@/lib/serveur/blog";
import { formatEuros } from "@/lib/procedures";
import { SITUATIONS } from "@/lib/situations";
import { tServeur } from "@/i18n/serveur";
import BoutonsAccueil from "./BoutonsAccueil";
import { EnteteSite } from "./composants/Entete";
import PiedSite from "./composants/PiedSite";

// Accueil (cahier des charges, 4.1 et 4.13) : rassurer avant tout. Dire où l'on est, montrer les visages des avocats,
// reconnaître l'inquiétude, expliquer simplement la suite, puis inviter à agir.

const initiales = (nom: string) =>
  nom
    .replace(/^Me\s+/, "")
    .split(/\s+/)
    .map((x) => x[0])
    .join("")
    .slice(0, 2);

export default async function Accueil() {
  const { t } = await tServeur();
  const d = await db();
  const { avocats: AVOCATS, faq: FAQ, accueil, tarifs } = await contenusPublics(d);
  const articles = (await publies(d).catch(() => [])).slice(0, 3);

  const Visage = ({ nom, photo }: { nom: string; photo: string | null }) =>
    photo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt="" />
    ) : (
      <span>{initiales(nom)}</span>
    );

  return (
    <>
      <EnteteSite />
      <main className="acc">
        <section className="acc-hero">
          <div className="wrap acc-hero-g">
            <div className="acc-hero-t">
              <p className="acc-eye">{t("Avocats au barreau de Paris · Droit des étrangers")}</p>
              <h1>{t(accueil.titre)}</h1>
              <p className="acc-sub">{t(accueil.sousTitre)}</p>
              <div className="h-cta ph-cta">
                <BoutonsAccueil />
              </div>
              <ul className="acc-eng">
                <li>{t("Prise en charge sous 48 heures ouvrées")}</li>
                <li>{t("Honoraires présentés avant tout paiement")}</li>
                <li>{t("Paiement en 3 fois sans frais")}</li>
              </ul>
            </div>
            <aside className="acc-mot">
              <div className="acc-visages" aria-hidden>
                {AVOCATS.map((a) => (
                  <span key={a.nom} className="acc-v">
                    <Visage nom={a.nom} photo={a.photo} />
                  </span>
                ))}
              </div>
              <blockquote>
                {t(
                  "Recevoir une décision de la préfecture est une épreuve. Vous n'avez pas à l'affronter seul. Nous lisons votre décision. Nous vous disons ce qu'elle permet. Puis nous agissons dans les délais.",
                )}
              </blockquote>
              <p className="acc-sign">{t("Les avocats du cabinet")}</p>
            </aside>
          </div>
        </section>

        <div className="wrap">
          <section className="acc-sec">
            <p className="acc-eye">{t("Vos avocats")}</p>
            <h2>{t("Des avocats, pas une plateforme anonyme")}</h2>
            <p className="acc-lead">
              {t(
                "Votre dossier est confié à l'un de nous. Nous l'étudions, rédigeons l'acte et le déposons. Vous savez qui vous défend. Vous pouvez nous écrire à tout moment depuis votre espace.",
              )}
            </p>
            <div className="acc-avocats">
              {AVOCATS.map((a) => (
                <figure key={a.nom} className="acc-av">
                  <div className="acc-av-ph">
                    <Visage nom={a.nom} photo={a.photo} />
                  </div>
                  <figcaption>
                    <b>{a.nom}</b>
                    {t(a.titre)
                      .split(" · ")
                      .map((l) => (
                        <span key={l}>{l}</span>
                      ))}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="acc-sec">
            <p className="acc-eye">{t("Comment cela se passe")}</p>
            <h2>{t("Trois étapes, sans vous déplacer")}</h2>
            <ol className="acc-etapes">
              <li>
                <b>{t("Vous exposez votre situation")}</b>
                <span>{t("Par écrit, à la voix ou en photo. Dans votre langue.")}</span>
              </li>
              <li>
                <b>{t("Nous vous indiquons la procédure et votre délai")}</b>
                <span>{t("Nos honoraires vous sont présentés avant tout paiement.")}</span>
              </li>
              <li>
                <b>{t("Nous formons votre recours")}</b>
                <span>{t("Nous vous écrivons sous 48 heures ouvrées. Vous suivez chaque étape dans votre espace.")}</span>
              </li>
            </ol>
          </section>

          <section className="acc-sec">
            <p className="acc-eye">{t("Vos démarches")}</p>
            <h2>{t("Votre situation, expliquée simplement")}</h2>
            <div className="acc-situ">
              {SITUATIONS.map((s) => (
                <Link key={s.slug} href={`/${s.slug}`} className="acc-situ-c">
                  <b>{t(s.nav)}</b>
                  <span>{t(s.description)}</span>
                </Link>
              ))}
            </div>
            <p className="acc-visio">
              <Link className="link" href="/consultation">
                {t("Vous préférez parler à un avocat ? Consultation en visio de 30 minutes, {prix}", { prix: formatEuros(tarifs.CONSULTATION) })}
              </Link>
            </p>
          </section>

          {articles.length > 0 && (
            <section className="acc-sec">
              <p className="acc-eye">{t("Actualités")}</p>
              <h2>{t("Comprendre vos droits")}</h2>
              <div className="acc-situ">
                {articles.map((a) => (
                  <Link key={a.id} href={`/actualites/${a.slug}`} className="acc-situ-c">
                    <b>{a.titre}</b>
                    <span>{a.chapo}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="acc-sec h-faq">
            <p className="acc-eye">{t("Questions fréquentes")}</p>
            <h2>{t("Ce que l'on nous demande souvent")}</h2>
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{t(f.q)}</summary>
                <p>{t(f.r)}</p>
              </details>
            ))}
          </section>

          <section className="acc-fin">
            <h2>{t("Vous n'êtes pas seul face à cette décision")}</h2>
            <p>{t("Exposez votre situation en quelques minutes. Nous prenons le relais.")}</p>
            <div className="h-cta ph-cta">
              <BoutonsAccueil />
            </div>
          </section>

          <PiedSite />
        </div>
      </main>
    </>
  );
}
