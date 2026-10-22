import { tServeur } from "@/i18n/serveur";
import { db } from "@/db";
import { formatEuros, type Diligence } from "@/lib/procedures";
import { lireParametre } from "@/lib/serveur/parametres";
import { EnteteSite } from "../composants/Entete";
import PiedSite from "../composants/PiedSite";

export const metadata = { title: "Honoraires — LEXPATRIA Avocats" };

const LIGNES: [Diligence | "PACK", string][] = [
  ["REQUETE", "Requête devant le tribunal administratif (tous les mémoires et la plaidoirie compris)"],
  ["REFERE_LIBERTE", "Référé-liberté ou référé mesures utiles"],
  ["REFERE_SUSPENSION_AVEC_REQUETE", "Référé-suspension, engagé avec la requête"],
  ["REFERE_SUSPENSION_SEUL", "Référé-suspension seul"],
  ["RAPO", "Recours administratif préalable obligatoire (visa, naturalisation)"],
  ["RECOURS_GRACIEUX", "Recours gracieux"],
  ["MISE_EN_DEMEURE", "Mise en demeure de la préfecture"],
  ["AVIS_PREALABLE", "Avis écrit d'un avocat"],
  ["DIAGNOSTIC", "Diagnostic écrit de votre situation"],
  ["MAJORATION_URGENCE", "Prise en charge en urgence (délai de moins de 3 jours ouvrés)"],
  ["APPEL", "Appel devant la cour administrative d'appel"],
];

export default async function Honoraires() {
  const { t } = await tServeur();
  const TARIFS = await lireParametre(await db(), "tarifs");
  return (
    <>
      <EnteteSite />
      <main>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="eyebrow">{t("Honoraires")}</div>
          <h1>{t("Des honoraires fixés à l'avance")}</h1>
          <p className="serif" style={{ color: "var(--ink-2)", fontSize: 18 }}>
            {t("Forfaits fermes, toutes taxes comprises, identiques pour tous les clients. Le prix de votre recours vous est indiqué dès que la procédure adaptée est identifiée, avant tout paiement. Paiement en une fois ou en trois fois.")}
          </p>
          <div className="card" style={{ marginTop: 18 }}>
            <div className="lines">
              {LIGNES.map(([d, l]) => (
                <div className="line" key={d}>
                  <span>{t(l)}</span>
                  <b>{formatEuros(d === "PACK" ? 0 : TARIFS[d])}</b>
                </div>
              ))}
            </div>
            <p className="note">
              {t("La plaidoirie est comprise dans le forfait. Hors Île-de-France, seuls les frais de déplacement font l'objet d'un avenant, soumis à votre accord. Le diagnostic écrit est déduit si vous confiez ensuite le dossier au cabinet ; l'avis préalable ne l'est pas.")}
            </p>
            <p className="note warn">{t("Aide juridictionnelle non acceptée.")}</p>
          </div>
          <h2 style={{ marginTop: 28 }}>{t("Contestations et médiation")}</h2>
          <p>
            {t("Toute contestation relative aux honoraires est portée devant le Bâtonnier de l'Ordre des avocats de Paris. Vous pouvez également, après une réclamation écrite adressée au cabinet, recourir au médiateur de la consommation de la profession d'avocat, 180 boulevard Haussmann, 75008 Paris.")}{" "}
            <a className="link" href="https://mediateur-consommation-avocat.fr" target="_blank" rel="noreferrer">
              mediateur-consommation-avocat.fr
            </a>
          </p>
          <PiedSite />
        </div>
      </main>
    </>
  );
}
