import { tServeur } from "@/i18n/serveur";
import { db } from "@/db";
import { formatEuros, type Diligence } from "@/lib/procedures";
import { contenusPublics } from "@/lib/serveur/parametres";
import { EnteteSite } from "../composants/Entete";
import PiedSite from "../composants/PiedSite";
import { BandeFin, Bandeau, Visages } from "../composants/Vitrine";

export const metadata = { title: "Honoraires — LEXPATRIA Avocats" };

const GROUPES: { titre: string; lignes: [Diligence, string][] }[] = [
  {
    titre: "Devant le tribunal",
    lignes: [
      ["REQUETE", "Requête devant le tribunal administratif"],
      ["REFERE_LIBERTE", "Référé-liberté ou référé mesures utiles"],
      ["REFERE_SUSPENSION_AVEC_REQUETE", "Référé-suspension, engagé avec la requête"],
      ["REFERE_SUSPENSION_SEUL", "Référé-suspension seul"],
      ["APPEL", "Appel devant la cour administrative d'appel"],
    ],
  },
  {
    titre: "Devant l'administration",
    lignes: [
      ["RAPO", "Recours administratif préalable obligatoire (visa, naturalisation)"],
      ["RECOURS_GRACIEUX", "Recours gracieux"],
      ["MISE_EN_DEMEURE", "Mise en demeure de la préfecture"],
    ],
  },
  {
    titre: "Conseil",
    lignes: [
      ["AVIS_PREALABLE", "Avis écrit d'un avocat"],
      ["DIAGNOSTIC", "Diagnostic écrit de votre situation"],
      ["MAJORATION_URGENCE", "Prise en charge en urgence (délai de moins de 3 jours ouvrés)"],
    ],
  },
];

export default async function Honoraires() {
  const { t } = await tServeur();
  const { tarifs: TARIFS, avocats, echeancier } = await contenusPublics(await db());
  return (
    <>
      <EnteteSite />
      <main className="acc">
        <Bandeau
          surtitre={t("Honoraires")}
          titre={t("Des honoraires clairs, connus avant de vous engager")}
          chapo={t("Nos forfaits sont fermes et toutes taxes comprises. Ils sont les mêmes pour tous. Nous vous indiquons le prix de votre recours dès que la procédure est identifiée, avant tout paiement.")}
        >
          <ul className="acc-eng">
            <li>{t("Forfait ferme, toutes taxes comprises")}</li>
            <li>{t("Paiement en 3 fois sans frais à partir de {seuil}", { seuil: formatEuros(echeancier.seuil) })}</li>
            <li>{t("Convention d'honoraires acceptée en ligne")}</li>
          </ul>
        </Bandeau>

        <div className="wrap">
          <section className="acc-sec">
            <p className="acc-eye">{t("Nos forfaits")}</p>
            <h2>{t("Chaque procédure a son prix")}</h2>
            <div className="pg-tarifs">
              {GROUPES.map((g) => (
                <div className="pg-carte" key={g.titre}>
                  <h3>{t(g.titre)}</h3>
                  <div className="lines">
                    {g.lignes.map(([d, l]) => (
                      <div className="line" key={d}>
                        <span>{t(l)}</span>
                        <b>{formatEuros(TARIFS[d])}</b>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="acc-lead pg-note">
              {t("Hors Île-de-France, seuls les frais de déplacement font l'objet d'un avenant, soumis à votre accord. Le diagnostic écrit est déduit si vous confiez ensuite le dossier au cabinet ; l'avis préalable ne l'est pas.")}
            </p>
            <p className="note warn">{t("Aide juridictionnelle non acceptée.")}</p>
          </section>

          <section className="acc-sec pg-duo">
            <div className="pg-carte">
              <Visages avocats={avocats} petit />
              <h3>{t("Un avocat, du début à la fin")}</h3>
              <p>{t("Le forfait couvre l'étude de votre dossier, la rédaction et le dépôt de votre recours, puis son suivi jusqu'à la décision.")}</p>
            </div>
            <div className="pg-carte">
              <p className="acc-eye">{t("Contestations et médiation")}</p>
              <p>
                {t("Toute contestation relative aux honoraires est portée devant le Bâtonnier de l'Ordre des avocats de Paris. Vous pouvez également, après une réclamation écrite adressée au cabinet, recourir au médiateur de la consommation de la profession d'avocat, 180 boulevard Haussmann, 75008 Paris.")}{" "}
                <a className="link" href="https://mediateur-consommation-avocat.fr" target="_blank" rel="noreferrer">
                  mediateur-consommation-avocat.fr
                </a>
              </p>
            </div>
          </section>

          <BandeFin titre={t("Connaître le prix de votre recours")} texte={t("Exposez votre situation. Nous vous indiquons la procédure, votre délai et notre forfait avant tout paiement.")} />
          <PiedSite />
        </div>
      </main>
    </>
  );
}
