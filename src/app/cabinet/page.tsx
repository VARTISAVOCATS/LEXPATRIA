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
          chapo={t("Lexpatria Avocats réunit des avocats au barreau de Paris qui consacrent leur pratique au contentieux du droit des étrangers. Ils défendent chaque jour des personnes confrontées à une OQTF, à un refus de titre, de visa ou de naturalisation.")}
          aside={
            <MotCabinet
              avocats={AVOCATS}
              texte={t("Derrière chaque dossier, il y a une vie, une famille, un travail. Nous prenons le temps de comprendre la vôtre avant d'agir.")}
              signature={t("Les avocats du cabinet")}
            />
          }
        />

        <div className="wrap">
          <section className="acc-sec">
            <p className="acc-eye">{t("Vos avocats")}</p>
            <h2>{t("Une équipe que vous connaissez")}</h2>
            <p className="acc-lead">
              {t("Docteurs en droit, ils allient la rigueur de la recherche à la pratique quotidienne des préfectures et des tribunaux administratifs. Votre dossier est confié à l'un d'eux, qui l'étudie, rédige, relit et dépose personnellement chaque acte.")}
            </p>
            <CartesAvocats avocats={AVOCATS} t={t} />
          </section>

          <section className="acc-sec">
            <p className="acc-eye">{t("Notre manière de travailler")}</p>
            <h2>{t("Écouter, expliquer, agir à temps")}</h2>
            <div className="acc-etapes pg-valeurs">
              <div>
                <b>{t("L'écoute")}</b>
                <span>{t("Vous vous exprimez dans votre langue, à votre rythme. Rien de ce que vous dites n'est jugé.")}</span>
              </div>
              <div>
                <b>{t("La clarté")}</b>
                <span>{t("Vous savez ce que permet votre décision, ce que nous allons faire et ce que cela coûte, avant de vous engager.")}</span>
              </div>
              <div>
                <b>{t("La rigueur des délais")}</b>
                <span>{t("En droit des étrangers, les délais sont courts. Votre dossier est pris en charge sous 48 heures ouvrées.")}</span>
              </div>
            </div>
          </section>

          <section className="acc-sec pg-duo">
            <div className="pg-carte">
              <p className="acc-eye">{t("Secret professionnel")}</p>
              <h3>{t("Intelligence artificielle, sous le contrôle de l'avocat")}</h3>
              <p>
                {t("Des outils d'intelligence artificielle assistent l'avocat pour lire les décisions et préparer les projets d'actes. L'avocat relit, modifie et valide personnellement chaque acte ; aucune décision n'est prise de manière automatisée. Votre dossier est couvert par le secret professionnel et la plateforme est hébergée en France.")}
              </p>
            </div>
            <div className="pg-carte">
              <p className="acc-eye">{t("Le cabinet")}</p>
              <h3>SELARL VARTIS Avocats</h3>
              <p>{t("Lexpatria Avocats est la dénomination commerciale de la SELARL VARTIS Avocats, cabinet d'avocats au barreau de Paris.")}</p>
              <p className="pg-adr">222 boulevard Saint-Germain, 75007 Paris</p>
            </div>
          </section>

          <BandeFin titre={t("Vous n'êtes pas seul face à cette décision")} texte={t("Exposez votre situation en quelques minutes. Un avocat du cabinet prend le relais.")} />
          <PiedSite />
        </div>
      </main>
    </>
  );
}
