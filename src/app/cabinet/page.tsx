import { tServeur } from "@/i18n/serveur";
import { db } from "@/db";
import { contenusPublics } from "@/lib/serveur/parametres";
import { EnteteSite } from "../composants/Entete";
import PiedSite from "../composants/PiedSite";
import { BandeFin, Bandeau, CartesAvocats, MotCabinet } from "../composants/Vitrine";

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
          titre={t("Des avocats à vos côtés, du premier mot à la décision du juge")}
          chapo={t("Nous sommes avocats au barreau de Paris. Nous consacrons notre pratique au contentieux du droit des étrangers. Chaque jour nous défendons des personnes confrontées à une OQTF ou à un refus de titre, de visa ou de naturalisation.")}
          aside={
            <MotCabinet
              avocats={AVOCATS}
              texte={t("Derrière chaque dossier il y a une vie. Une famille, un travail. Nous prenons le temps de comprendre la vôtre avant d'agir.")}
              signature={t("Les avocats du cabinet")}
            />
          }
        />

        <div className="wrap">
          <section className="acc-sec">
            <p className="acc-eye">{t("Vos avocats")}</p>
            <h2>{t("Une équipe que vous connaissez")}</h2>
            <p className="acc-lead">
              {t("Tous docteurs en droit, nous allions la rigueur de la recherche à la pratique des préfectures et des tribunaux. Votre dossier est confié à l'un de nous. Il l'étudie puis rédige et dépose chaque acte.")}
            </p>
            <CartesAvocats avocats={AVOCATS} t={t} />
          </section>

          <section className="acc-sec">
            <p className="acc-eye">{t("Notre manière de travailler")}</p>
            <h2>{t("Écouter, expliquer, agir à temps")}</h2>
            <div className="acc-etapes pg-valeurs">
              <div>
                <b>{t("L'écoute")}</b>
                <span>{t("Vous vous exprimez dans votre langue et à votre rythme. Nous ne jugeons rien de ce que vous dites.")}</span>
              </div>
              <div>
                <b>{t("La clarté")}</b>
                <span>{t("Avant tout engagement vous savez ce que permet votre décision. Vous savez ce que nous allons faire et ce que cela coûte.")}</span>
              </div>
              <div>
                <b>{t("La rigueur des délais")}</b>
                <span>{t("Les délais sont courts en droit des étrangers. Nous prenons votre dossier en charge sous 48 heures ouvrées.")}</span>
              </div>
            </div>
          </section>

          <section className="acc-sec pg-duo">
            <div className="pg-carte">
              <p className="acc-eye">{t("Notre méthode")}</p>
              <h3>{t("L'intelligence artificielle, sous notre contrôle")}</h3>
              <p>
                {t("Des outils d'intelligence artificielle nous aident à lire les décisions et à préparer les projets d'actes. Chaque acte est relu et validé par l'un de nous. Aucune décision n'est prise de manière automatisée. La plateforme est hébergée en France.")}
              </p>
            </div>
            <div className="pg-carte">
              <p className="acc-eye">{t("Le cabinet")}</p>
              <h3>SELARL VARTIS Avocats</h3>
              <p>{t("Lexpatria Avocats est la dénomination commerciale de la SELARL VARTIS Avocats, cabinet d'avocats au barreau de Paris.")}</p>
              <p className="pg-adr">222 boulevard Saint-Germain, 75007 Paris</p>
            </div>
          </section>

          <BandeFin titre={t("Vous n'êtes pas seul face à cette décision")} texte={t("Exposez votre situation en quelques minutes. Nous prenons le relais.")} />
          <PiedSite />
        </div>
      </main>
    </>
  );
}
