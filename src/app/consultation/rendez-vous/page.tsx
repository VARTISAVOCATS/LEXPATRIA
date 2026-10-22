// Choix du créneau de la consultation en visio (lien envoyé après paiement, valable 30 jours).
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { tServeur } from "@/i18n/serveur";
import { verifier } from "@/lib/jeton";
import type { RendezVous } from "@/lib/serveur/integrations/bookings";
import { EnteteParcours } from "../../composants/Entete";
import ChoixCreneau from "./ChoixCreneau";

export const metadata = { title: "Votre rendez-vous — LEXPATRIA Avocats", robots: { index: false } };
export const dynamic = "force-dynamic";

const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" });

export default async function RendezVousPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { t } = await tServeur();
  const { jeton = "" } = await searchParams;
  const id = verifier(jeton, "rdv");
  const [dos] = id ? await (await db()).select().from(schema.dossiers).where(eq(schema.dossiers.id, id)) : [];
  const rdv = dos?.rendezVous as RendezVous | null;
  return (
    <>
      <EnteteParcours />
      <main>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="card">
            {!dos ? (
              <>
                <h1>{t("Lien expiré ou invalide")}</h1>
                <p>{t("Connectez-vous à votre espace pour retrouver votre dossier.")}</p>
              </>
            ) : rdv ? (
              <>
                <p className="surtitre">{t("Dossier {ref}", { ref: dos.reference })}</p>
                <h1>{t("Votre rendez-vous est fixé")}</h1>
                <p className="esp-rdv">{t("Consultation en visio le {date} (heure de Paris).", { date: quand(rdv.debut) })}</p>
                <p className="note">
                  {rdv.simule
                    ? "Rendez-vous simulé (Microsoft Bookings n'est pas encore configuré)."
                    : t("Le lien de connexion vous a été envoyé par e-mail ; il permet aussi de déplacer le rendez-vous jusqu'à 24 heures à l'avance.")}
                </p>
                {rdv.lienVisio && (
                  <a className="btn cta" href={rdv.lienVisio} target="_blank" rel="noreferrer">
                    {t("Rejoindre la visio")}
                  </a>
                )}
              </>
            ) : dos.statut !== "PAYE" ? (
              <>
                <h1>{t("Paiement en cours de confirmation")}</h1>
                <p>{t("Actualisez cette page dans quelques instants. Le lien vous a aussi été envoyé par e-mail.")}</p>
              </>
            ) : (
              <>
                <p className="surtitre">{t("Dossier {ref}", { ref: dos.reference })}</p>
                <h1>{t("Choisissez votre rendez-vous")}</h1>
                <p>{t("Consultation de 30 minutes en visio. Les horaires sont à l'heure de Paris.")}</p>
                <ChoixCreneau jeton={jeton} />
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
