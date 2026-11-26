// Acceptation de la convention d'intervention sans honoraires (lien reçu par e-mail).
import Link from "next/link";
import { db } from "@/db";
import { tServeur } from "@/i18n/serveur";
import { lireProBono } from "@/lib/serveur/probono";
import { EnteteParcours } from "../../composants/Entete";
import Accepter from "./Accepter";

export const metadata = { title: "Convention d'intervention — LEXPATRIA Avocats", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ProBono({ params }: { params: Promise<{ jeton: string }> }) {
  const { t } = await tServeur();
  const { jeton } = await params;
  const x = await lireProBono(await db(), decodeURIComponent(jeton));
  return (
    <>
      <EnteteParcours />
      <main>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="card">
            {!x ? (
              <>
                <h1>{t("Lien expiré ou invalide")}</h1>
                <p>{t("Contactez le cabinet pour recevoir un nouveau lien.")}</p>
              </>
            ) : x.dejaAcceptee ? (
              <>
                <h1>{t("Votre dossier est pris en charge")}</h1>
                <p>{t("La convention a déjà été acceptée. Suivez votre dossier depuis votre espace.")}</p>
                <Link href="/espace" className="btn btn-action large">
                  {t("Accéder à mon espace")}
                </Link>
              </>
            ) : (
              <>
                <h1>{t("Votre dossier {ref}", { ref: x.dos.reference })}</h1>
                <p>
                  {x.avocat
                    ? t("Le cabinet accepte de prendre en charge votre dossier sans honoraires. Il sera traité par {avocat}.", { avocat: x.avocat })
                    : t("Le cabinet accepte de prendre en charge votre dossier sans honoraires.")}
                </p>
                <p>{t("Pour confirmer, lisez la convention d'intervention puis acceptez-la.")}</p>
                <details className="esp-conv" open>
                  <summary>{t("Convention d'intervention sans honoraires")}</summary>
                  <pre>{x.texte}</pre>
                </details>
                <Accepter jeton={decodeURIComponent(jeton)} />
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
