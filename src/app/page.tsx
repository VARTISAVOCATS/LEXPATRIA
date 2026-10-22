import Link from "next/link";
import { db } from "@/db";
import { contenusPublics } from "@/lib/serveur/parametres";
import { SITUATIONS } from "@/lib/situations";
import { tServeur } from "@/i18n/serveur";
import BoutonsAccueil from "./BoutonsAccueil";
import { EnteteSite } from "./composants/Entete";
import PiedSite from "./composants/PiedSite";

// Accueil (cahier des charges, 4.1), dans l'interface validée : dire où l'on est et qui sont les avocats,
// puis inviter à exposer sa situation ou à transmettre sa décision.

export default async function Accueil() {
  const { t } = await tServeur();
  const { avocats: AVOCATS, faq: FAQ, accueil } = await contenusPublics(await db());
  return (
    <>
      <EnteteSite />
      <main>
        <div className="wrap">
          <section className="hero h41">
            <div>
              <h1>{t(accueil.titre)}</h1>
              <p className="sub">
                {t(accueil.sousTitre)}
              </p>
              <div className="h-cta ph-cta">
                <BoutonsAccueil />
                <p className="ph-ia">{t("Votre décision est lue par un outil d'intelligence artificielle du cabinet, puis vérifiée par votre avocat.")}</p>
              </div>
            </div>
          </section>

          <section className="sec h-law">
            <h2>{t("Vos avocats")}</h2>
            {AVOCATS.map((a) => (
              <div className="hl" key={a.nom}>
                <span className="av" aria-hidden style={a.photo ? { overflow: "hidden", padding: 0 } : undefined}>
                  {a.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", display: "block" }} />
                  ) : (
                    a.nom.replace("Me ", "").split(" ").map((x) => x[0]).join("")
                  )}
                </span>
                <div>
                  <b>{a.nom}</b>
                  <p>{t(a.titre)}</p>
                </div>
              </div>
            ))}
            <div>
              <div className="lv attente" role="group" aria-label={t("Le mot de l'avocat")}>
                <div className="lv-m">
                  <span className="lv-t">{t("Le mot de l'avocat")}</span>
                  <span className="lv-w">{t("Un avocat du cabinet · 45 s")}</span>
                </div>
              </div>
              <p className="lv-n">{t("Vidéo en préparation : elle sera tournée par un avocat du cabinet et sous-titrée en français, arabe, anglais et espagnol.")}</p>
            </div>
          </section>

          <section className="sec h-steps">
            <h2>{t("Comment se déroule votre recours")}</h2>
            <ol>
              <li>{t("Vous exposez votre situation ou photographiez votre décision.")}</li>
              <li>{t("La procédure adaptée, votre délai et le prix vous sont indiqués.")}</li>
              <li>{t("Votre avocat forme le recours, devant l'administration ou le tribunal selon votre cas, et vous tient informé à chaque étape.")}</li>
            </ol>
          </section>

          <section className="sec h-situ">
            <h2>{t("Vos démarches")}</h2>
            <p>{t("Les délais et la procédure, expliqués situation par situation.")}</p>
            <nav className="si-list" aria-label={t("Vos démarches")}>
              {SITUATIONS.map((s) => (
                <Link key={s.slug} className="link" href={`/${s.slug}`}>
                  {t(s.nav)}
                </Link>
              ))}
            </nav>
          </section>

          <section className="sec h-faq">
            <h2>{t("Questions fréquentes")}</h2>
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{t(f.q)}</summary>
                <p>{t(f.r)}</p>
              </details>
            ))}
          </section>

          <PiedSite />
        </div>
      </main>
    </>
  );
}
