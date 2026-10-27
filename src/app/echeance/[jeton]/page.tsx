// Page de régularisation d'une échéance rejetée (lien reçu par e-mail) : montant, puis paiement par carte.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { echeancier } from "@/db/schema";
import { tServeur } from "@/i18n/serveur";
import { dateCourte } from "@/lib/echeancier";
import { verifier } from "@/lib/jeton";
import { formatEuros } from "@/lib/procedures";
import { aRegler } from "@/lib/serveur/echeancier";
import { EnteteParcours } from "../../composants/Entete";
import Regulariser from "./Regulariser";

export const metadata = { title: "Régler une échéance — LEXPATRIA Avocats", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ jeton: string }> }) {
  const { t } = await tServeur();
  const jeton = decodeURIComponent((await params).jeton);
  const id = verifier(jeton, "echeance");
  const [e] = id ? await (await db()).select().from(echeancier).where(eq(echeancier.id, id)) : [];
  return (
    <>
      <EnteteParcours />
      <main>
        <div className="wrap" style={{ maxWidth: 560 }}>
          <div className="card">
            <h1>{t("Régler votre échéance")}</h1>
            {!e ? (
              <p>{t("Ce lien a expiré. Vous pouvez écrire au cabinet depuis votre espace.")}</p>
            ) : e.statut === "PAYE" ? (
              <p>{t("Cette échéance est réglée.")}</p>
            ) : e.statut !== "ECHEC" ? (
              <p>{t("Cette échéance n'est pas à régler pour le moment.")}</p>
            ) : (
              <>
                <p>
                  {t("Échéance {rang}/3 prévue le {date}.", { rang: e.rang, date: dateCourte(e.le) })}
                  {e.penalite ? ` ${t("Pénalité forfaitaire incluse : {montant}.", { montant: formatEuros(e.penalite) })}` : ""}
                </p>
                <div className="recap">
                  <span>{t("Montant à régler")}</span> <b>{formatEuros(aRegler(e))}</b>
                </div>
                <Regulariser jeton={jeton} montant={aRegler(e)} />
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
