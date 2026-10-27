import { EnteteParcours } from "../../composants/Entete";
import { tServeur } from "@/i18n/serveur";
// Page de règlement par un proche (cahier des charges, 5.3) : référence, procédure, montant et nom du client,
// jamais le récit ni les pièces (secret professionnel).

import { db } from "@/db";
import { verifier } from "@/lib/jeton";
import { tvaApplicable } from "@/lib/pays";
import { formatEuros, PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { charger, offre } from "@/lib/serveur/paiement";
import ReglementProche from "./ReglementProche";

export const metadata = { title: "Régler des honoraires — LEXPATRIA Avocats", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Regler({ params }: { params: Promise<{ jeton: string }> }) {
  const { t } = await tServeur();
  const { jeton } = await params;
  const id = verifier(jeton, "proche");
  const base = await db();
  const c = id ? await charger(base, id) : null;
  const offreCalculee = c ? await offre(base, c.dos) : null;

  return (
    <>
      <EnteteParcours />
      <main>
        <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="card">
        {!c ? (
          <>
            <h1>{t("Lien expiré ou invalide")}</h1>
            <p>{t("Demandez à votre proche de vous renvoyer un nouveau lien depuis son dossier.")}</p>
          </>
        ) : c.dos.statut !== "ATTENTE_PROCHE" ? (
          <>
            <h1>{t("Ces honoraires sont déjà réglés")}</h1>
            <p>{t("Merci. Le dossier {ref} est pris en charge par le cabinet.", { ref: c.dos.reference })}</p>
          </>
        ) : (
          (() => {
            const o = offreCalculee!;
            return (
              <>
                <p className="surtitre">{t("Règlement d'honoraires d'avocat")}</p>
                <h1>
                  {t("{nom} vous demande de régler ses honoraires d'avocat", { nom: `${t(c.cli.civilite === "MADAME" ? "Madame" : "Monsieur")} ${c.cli.prenom} ${c.cli.nom}` })}
                </h1>
                <div className="recap">
                  <p>{t("Dossier {ref}", { ref: c.dos.reference })}</p>
                  <p>{t(PROCEDURES[o.code as CodeProcedure].libelle)}</p>
                  <p>
                    <strong>
                      {formatEuros(o.total)} {tvaApplicable(c.cli.pays) ? t("TTC") : t("(TVA non applicable)")}
                    </strong>
                  </p>
                </div>
                <p className="petite">
                  {t("La note d'honoraires est établie au nom de votre proche, avec la mention « réglée par un tiers ». Le contenu du dossier ne vous est pas accessible.")}
                </p>
                <ReglementProche jeton={jeton} total={o.total} />
              </>
            );
          })()
        )}
              </div>
        </div>
      </main>
    </>
  );
}
