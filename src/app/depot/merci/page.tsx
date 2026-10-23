import { EnteteParcours } from "../../composants/Entete";
// Page « Paiement validé » (cahier des charges, 5.3) : une phrase qui nomme l'avocat attribué,
// puis la suite immédiate du travail (décision et enveloppe), présentée comme déjà commencée.

import { eq } from "drizzle-orm";
import Link from "next/link";
import { tServeur } from "@/i18n/serveur";
import { db, schema } from "@/db";
import { marquerPaye } from "@/lib/serveur/paiement";
import { stripe } from "@/lib/stripe";
import { verifier } from "@/lib/jeton";
import type { CodeProcedure } from "@/lib/procedures";
import type { Reponses } from "@/lib/questionnaire";
import Collecte from "./Collecte";

export const metadata = { title: "Paiement validé — LEXPATRIA Avocats" };
export const dynamic = "force-dynamic";

export default async function Merci({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { t } = await tServeur();
  const p = await searchParams;
  const d = await db();
  const [dos] = p.ref ? await d.select().from(schema.dossiers).where(eq(schema.dossiers.reference, p.ref)) : [];

  // Retour de Stripe avant le webhook : on vérifie l'intention auprès de Stripe, jamais sur la foi de l'adresse.
  if (dos && p.payment_intent && dos.statut !== "PAYE") {
    const s = await stripe();
    const pi = s ? await s.paymentIntents.retrieve(p.payment_intent).catch(() => null) : null;
    if (pi && pi.status === "succeeded" && pi.metadata?.dossierId === dos.id) {
      await marquerPaye(d, dos.id, { intentId: pi.id, moyen: pi.payment_method_types?.join(",") });
    }
  }
  const [frais] = dos ? await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, dos.id)) : [];
  const [client] = frais ? await d.select().from(schema.clients).where(eq(schema.clients.id, frais.clientId)) : [];
  const [avocat] = frais?.avocatId ? await d.select().from(schema.utilisateurs).where(eq(schema.utilisateurs.id, frais.avocatId)) : [];
  const paye = frais && frais.statut !== "PRE_DOSSIER" && frais.statut !== "ATTENTE_PROCHE";
  const urgent = frais?.traitement === "URGENCE";
  const delaiPriseEnCharge = urgent ? "10 heures ouvrées" : "48 heures ouvrées";

  return (
    <>
      <EnteteParcours />
      <main>
        <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="card">
        {!frais ? (
          <h1>{t("Dossier introuvable")}</h1>
        ) : !paye ? (
          <>
            <h1>{t("Paiement en cours de confirmation")}</h1>
            <p>{t("Votre dossier {ref} est conservé. Cette page se met à jour dès que le paiement est confirmé.", { ref: frais.reference })}</p>
            <meta httpEquiv="refresh" content="5" />
          </>
        ) : (
          <>
            <div className="succ"><span className="succ-i" aria-hidden>✓</span><div><b>{t("Paiement validé")}</b></div></div>
            <h1>
              {avocat
                ? t("Votre dossier sera traité par Maître {nom}, qui prendra attache avec vous sous {delai}.", { nom: `${avocat.prenom} ${avocat.nom}`, delai: t(delaiPriseEnCharge) })
                : t("Votre dossier est transmis au cabinet : un avocat prendra attache avec vous sous {delai}.", { delai: t(delaiPriseEnCharge) })}
            </h1>
            <p className="aide">{t("Dossier {ref}. Vous recevez un e-mail de confirmation avec votre lien de connexion.", { ref: frais.reference })}</p>

            {frais.avisPrealable || frais.procedure === "DIAGNOSTIC" ? (
              <p>{t("Votre avocat dispose de votre questionnaire et de vos documents. Vous recevez son avis écrit sous 48 heures ouvrées, dans votre espace.")}</p>
            ) : (
              <>
            <Collecte
              reference={frais.reference}
              jetonServeur={p.suite && verifier(p.suite) === frais.id ? p.suite : null}
              contexte={{ procedure: frais.procedure as CodeProcedure, algerien: client?.algerien ?? null, avisOuDiagnostic: false }}
              reponsesInitiales={((frais.qualification ?? {}) as { reponses?: Reponses }).reponses ?? {}}
              faits={((frais.triage ?? {}) as { faits?: string[] }).faits ?? []}
            />
              </>
            )}
            {!frais.avisPrealable && frais.procedure !== "DIAGNOSTIC" && (
            <p className="petite">
              {t("Votre attestation de prise en charge, à présenter en cas de contrôle, sera disponible dans votre espace dès que votre avocat aura accepté le dossier.")}
            </p>
            )}
          </>
        )}
              </div>
        </div>
      </main>
    </>
  );
}
