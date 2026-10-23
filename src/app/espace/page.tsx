// Lot 2 : espace client. Connexion par code reçu par e-mail, puis liste des dossiers.
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tServeur } from "@/i18n/serveur";
import { PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { dossiersDuClient } from "@/lib/serveur/dossiers";
import { clientConnecte } from "@/lib/serveur/session";
import { frDate, libelleClient, type Statut } from "@/lib/statuts";
import Connexion from "../composants/Connexion";
import { EnteteEspace } from "../composants/Entete";

export const metadata = { title: "Mon espace — LEXPATRIA Avocats", robots: { index: false } };

export default async function Espace() {
  const { t } = await tServeur();
  const email = await clientConnecte();
  const liste = email ? await dossiersDuClient(await db(), email) : [];
  if (email && liste.length === 1) redirect(`/espace/${liste[0].dos.reference}`);
  return (
    <>
      <EnteteEspace espace="CLIENT" sousTitre="Mon espace" accueil="/espace" connecte={!!email} />
      <main className="esp">
        <div className="wrap" style={{ maxWidth: 820 }}>
          {!email ? (
            <Connexion
              espace="CLIENT"
              titre="Mon espace"
              intro="Retrouvez le suivi de votre recours, vos pièces et les messages de votre avocat. Indiquez l'adresse e-mail donnée lors de votre dépôt : vous recevrez un code de connexion."
            />
          ) : (
            <>
              <h1>{t("Mes dossiers")}</h1>
              {liste.length === 0 && <p className="card">{t("Aucun dossier n'est encore associé à cette adresse.")}</p>}
              <div className="esp-liste">
                {liste.map(({ dos, avocatPrenom, avocatNom }) => (
                  <Link key={dos.id} href={`/espace/${dos.reference}`} className="card esp-carte">
                    <span className="esp-ref">{t("Dossier {ref}", { ref: dos.reference })}</span>
                    <b>{t(PROCEDURES[dos.procedure as CodeProcedure]?.libelle ?? dos.procedure)}</b>
                    <span className="pill n">{t(libelleClient(dos.statut as Statut, dos.procedure, dos.avisPrealable))}</span>
                    {avocatNom && <span>{t("Votre avocat : Maître {nom}", { nom: `${avocatPrenom} ${avocatNom}` })}</span>}
                    {dos.dateLimite && <span className="esp-dl">{t("Date limite : {date}", { date: frDate(dos.dateLimite) })}</span>}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
