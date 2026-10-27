import { tServeur } from "@/i18n/serveur";
import { db } from "@/db";
import { contenusPublics } from "@/lib/serveur/parametres";
import { EnteteSite } from "../composants/Entete";
import PiedSite from "../composants/PiedSite";
import { BandeFin, Bandeau, CartesAvocats } from "../composants/Vitrine";

export const metadata = { title: "Le cabinet — LEXPATRIA Avocats" };

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
          chapo={t("Le cabinet réunit des avocats au barreau de Paris qui consacrent leur pratique au contentieux du droit des étrangers. Ils assistent chaque jour des personnes visées par une OQTF ou par un refus de titre de séjour, de visa ou de naturalisation.")}
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

          <section className="acc-sec">
            <p className="acc-eye">{t("Méthode de travail")}</p>
            <h2>{t("Écoute, clarté et respect des délais")}</h2>
            <div className="acc-etapes pg-valeurs">
              <div>
                <b>{t("L'écoute")}</b>
                <span>{t("Vous exposez votre situation dans votre langue, par écrit ou à l'oral, sans contrainte de temps.")}</span>
              </div>
              <div>
                <b>{t("La clarté")}</b>
                <span>{t("Avant tout engagement, vous savez ce que permet votre décision, quelle procédure sera engagée et quel en est le coût.")}</span>
              </div>
              <div>
                <b>{t("La rigueur des délais")}</b>
                <span>{t("Les délais de recours sont brefs en droit des étrangers : chaque dossier est pris en charge sous 48 heures ouvrées.")}</span>
              </div>
            </div>
          </section>

          <section className="acc-sec pg-duo">
            <div className="pg-carte">
              <p className="acc-eye">{t("Outils")}</p>
              <h3>{t("L'intelligence artificielle, sous le contrôle de l'avocat")}</h3>
              <p>
                {t("Des outils d'intelligence artificielle facilitent la lecture des décisions et la préparation des projets d'actes. Chaque acte est relu et validé par un avocat du cabinet, et aucune décision n'est prise de manière automatisée. La plateforme est hébergée en France.")}
              </p>
            </div>
            <div className="pg-carte">
              <p className="acc-eye">{t("Le cabinet")}</p>
              <h3>SELARL VARTIS Avocats</h3>
              <p>{t("Lexpatria Avocats est le nom commercial de la SELARL VARTIS Avocats, société d'avocats au barreau de Paris.")}</p>
              <p className="pg-adr">222 boulevard Saint-Germain, 75007 Paris</p>
            </div>
          </section>

          <BandeFin titre={t("Votre décision appelle une réponse dans un délai court")} texte={t("Exposez votre situation en quelques minutes : un avocat du cabinet prend ensuite votre dossier en charge.")} />
          <PiedSite />
        </div>
      </main>
    </>
  );
}
