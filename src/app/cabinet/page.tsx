import { tServeur } from "@/i18n/serveur";
import { meta } from "@/lib/seo";
import { db } from "@/db";
import { contenusPublics } from "@/lib/serveur/parametres";
import { EnteteSite } from "../composants/Entete";
import PiedSite from "../composants/PiedSite";
import { BandeFin, Bandeau, CartesAvocats } from "../composants/Vitrine";

export const metadata = meta("Le cabinet — LEXPATRIA Avocats", "Lexpatria Avocats, cabinet d'avocats au barreau de Paris consacré au contentieux du droit des étrangers.", "/cabinet");

export default async function Cabinet() {
  const { t } = await tServeur();
  const { avocats: AVOCATS } = await contenusPublics(await db());
  return (
    <>
      <EnteteSite />
      <main className="acc">
        <Bandeau
          surtitre={t("Le cabinet")}
          titre={t("Un avocat suit votre recours jusqu'à la décision du tribunal")}
          chapo={t("Le cabinet consacre sa pratique au contentieux du droit des étrangers.")}
        />

        <div className="wrap">
          <section className="acc-sec">
            <p className="acc-eye">{t("Vos avocats")}</p>
            <h2>{t("Une équipe d'avocats docteurs en droit")}</h2>
            <p className="acc-lead">
              {t("Tous docteurs en droit, les avocats du cabinet associent la rigueur de la recherche à la pratique quotidienne des préfectures et des juridictions administratives.")}
            </p>
            <CartesAvocats avocats={AVOCATS} t={t} />
          </section>


          <section className="acc-sec pg-duo">
            <div className="pg-carte">
              <p className="acc-eye">{t("Outils")}</p>
              <h3>{t("L'intelligence artificielle, sous le contrôle de l'avocat")}</h3>
              <p>
                {t("Des outils d'intelligence artificielle aident à lire les décisions et à préparer les projets d'actes. Chaque acte est relu et validé par l'avocat. La plateforme est hébergée en France.")}
              </p>
            </div>
            <div className="pg-carte">
              <p className="acc-eye">{t("Le cabinet")}</p>
              <h3>SELARL VARTIS Avocats</h3>
              <p>{t("Lexpatria Avocats est le nom commercial de la SELARL VARTIS Avocats, société d'avocats au barreau de Paris.")}</p>
              <p className="pg-adr">222 boulevard Saint-Germain, 75007 Paris</p>
            </div>
          </section>

          <BandeFin titre={t("Votre décision appelle une réponse dans un délai court")} texte={t("Exposez votre situation en quelques minutes.")} />
          <PiedSite />
        </div>
      </main>
    </>
  );
}
