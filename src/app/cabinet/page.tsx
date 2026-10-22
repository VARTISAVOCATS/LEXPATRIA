import { tServeur } from "@/i18n/serveur";
import { db } from "@/db";
import { contenusPublics } from "@/lib/serveur/parametres";
import { EnteteSite } from "../composants/Entete";
import PiedSite from "../composants/PiedSite";

export const metadata = { title: "Le cabinet — LEXPATRIA Avocats" };

export default async function Cabinet() {
  const { t } = await tServeur();
  const { avocats: AVOCATS } = await contenusPublics(await db());
  return (
    <>
      <EnteteSite />
      <main>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="eyebrow">{t("Le cabinet")}</div>
          <h1>{t("Des avocats au barreau de Paris")}</h1>
          <p className="serif" style={{ color: "var(--ink-2)", fontSize: 18 }}>
            {t("Lexpatria Avocats est la dénomination commerciale de la SELARL VARTIS Avocats, cabinet d'avocats au barreau de Paris, 222 boulevard Saint-Germain, 75007 Paris. Chaque dossier déposé sur la plateforme est pris en charge par un avocat du cabinet, qui étudie la situation, rédige, relit et dépose personnellement chaque acte.")}
          </p>
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
          </section>
          <section className="sec">
            <h2>{t("Intelligence artificielle et secret professionnel")}</h2>
            <p>
              {t("Des outils d'intelligence artificielle assistent l'avocat pour lire les décisions et préparer les projets d'actes. L'avocat relit, modifie et valide personnellement chaque acte ; aucune décision n'est prise de manière automatisée. Votre dossier est couvert par le secret professionnel et la plateforme est hébergée en France.")}
            </p>
          </section>
          <PiedSite />
        </div>
      </main>
    </>
  );
}
