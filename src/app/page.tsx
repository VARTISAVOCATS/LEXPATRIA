import Link from "next/link";
import { db } from "@/db";
import { contenusPublics } from "@/lib/serveur/parametres";
import { publies } from "@/lib/serveur/blog";
import { formatEuros } from "@/lib/procedures";
import { SITUATIONS } from "@/lib/situations";
import { tServeur } from "@/i18n/serveur";
import { BASE, cabinetLd, ld, meta, NOM } from "@/lib/seo";
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

export const metadata = meta(
  "Recours OQTF, titre de séjour, visa — LEXPATRIA Avocats",
  "Avocats au barreau de Paris : recours contre une OQTF, un refus de titre de séjour, de visa ou de naturalisation. Prix indiqué avant tout paiement.",
  "/",
);

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

  const donnees = {
    "@graph": [
      cabinetLd(AVOCATS),
      { "@type": "WebSite", "@id": `${BASE}/#site`, url: BASE, name: NOM, inLanguage: "fr-FR", publisher: { "@id": `${BASE}/#cabinet` } },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.r } })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(donnees) }} />
      <EnteteSite />
      <main className="acc">
        <section className="acc-hero">
          <div className="wrap pg-hero-s">
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
          </div>
        </section>

        <div className="wrap">
          <section className="acc-sec">
            <p className="acc-eye">{t("Vos avocats")}</p>
            <h2>{t("Un avocat du cabinet désigné pour chaque dossier")}</h2>
            <p className="acc-lead">
              {t(
                "Votre avocat rédige et dépose l'acte puis reste votre interlocuteur jusqu'à la décision.",
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
            <p className="acc-eye">{t("Déroulement")}</p>
            <h2>{t("Trois étapes, sans vous déplacer")}</h2>
            <ol className="acc-etapes">
              <li>
                <b>{t("Vous exposez votre situation")}</b>
                <span>{t("Par écrit ou à la voix, dans votre langue.")}</span>
              </li>
              <li>
                <b>{t("La procédure et votre délai vous sont indiqués")}</b>
                <span>{t("Les honoraires du cabinet vous sont présentés avant tout paiement.")}</span>
              </li>
              <li>
                <b>{t("Un avocat forme votre recours")}</b>
                <span>{t("Il prend contact avec vous sous 48 heures ouvrées.")}</span>
              </li>
            </ol>
          </section>

          <section className="acc-sec">
            <p className="acc-eye">{t("Vos démarches")}</p>
            <h2>{t("Les recours selon votre situation")}</h2>
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
                {t("Consulter un avocat en visio : 30 minutes, {prix}.", { prix: formatEuros(tarifs.CONSULTATION) })}
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
            <h2>{t("Les réponses aux questions les plus courantes")}</h2>
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{t(f.q)}</summary>
                <p>{t(f.r)}</p>
              </details>
            ))}
          </section>

          <section className="acc-fin">
            <h2>{t("Votre décision appelle une réponse dans un délai court")}</h2>
            <p>{t("Exposez votre situation en quelques minutes.")}</p>
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
