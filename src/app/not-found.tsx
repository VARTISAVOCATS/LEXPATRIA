import { EnteteParcours } from "./composants/Entete";
import Link from "next/link";
import { tServeur } from "@/i18n/serveur";

export default async function Introuvable() {
  const { t } = await tServeur();
  return (
    <>
      <EnteteParcours />
      <main>
        <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="card">
        <h1>{t("Page introuvable")}</h1>
        <p>{t("Cette page n'existe pas ou a été déplacée.")}</p>
        <Link className="btn btn-action large" href="/">
          {t("Revenir à l'accueil")}
        </Link>
              </div>
        </div>
      </main>
    </>
  );
}
