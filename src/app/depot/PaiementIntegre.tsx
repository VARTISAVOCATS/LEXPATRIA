"use client";

// Paiement intégré à l'écran (cahier des charges, 4.8 et 4.12). Deux moyens seulement, pour ne pas disperser :
// la carte (avec Apple Pay / Google Pay) quand le client paie en une fois, Klarna quand il a choisi trois fois. Le prospect ne quitte jamais le site,
// sauf le temps de l'authentification Klarna si elle l'exige.
// Sans clé publique Stripe (développement) : bouton de paiement simulé.

import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js/pure";
import { useState } from "react";
import { useLangue, useT } from "@/i18n/client";
import { formatEuros } from "@/lib/procedures";
import { useContenus } from "../composants/Contenus";

// Clé publiable lue au back office (rubrique Connexions) et transmise par le serveur.
const promesses = new Map<string, Promise<Stripe | null>>();
const stripeJs = (cle: string, locale: "fr" | "ar" | "en" | "es") => {
  if (!promesses.has(cle)) promesses.set(cle, loadStripe(cle, { locale }));
  return promesses.get(cle)!;
};

/** Redirection après paiement (la démo sans serveur intercepte cette navigation). */
function allerVers(url: string) {
  const w = window as unknown as { __lexpatriaNaviguer?: (u: string) => void };
  if (w.__lexpatriaNaviguer) w.__lexpatriaNaviguer(url);
  else window.location.href = url;
}

/** Moyens affichés : carte seule, Klarna seul (trois fois), ou les deux quand le client n'a pas encore choisi. */
export type Moyens = "CARTE" | "KLARNA" | "CARTE_KLARNA";
const TYPES: Record<Moyens, string[]> = { CARTE: ["card"], KLARNA: ["klarna"], CARTE_KLARNA: ["card", "klarna"] };

export interface ProprietesPaiement {
  total: number;
  moyens?: Moyens;
  /** Vérifie les préalables (cases cochées) ; renvoie un message d'erreur ou null. */
  verifier: () => string | null;
  /** Ouvre le paiement côté serveur avec les moyens affichés : { clientSecret } ou { simulation: true }. */
  ouvrir: (moyens: Moyens) => Promise<{ clientSecret?: string; simulation?: boolean; reference: string }>;
  urlRetour: (reference: string) => string;
  libelle?: string;
}

export default function PaiementIntegre(p: ProprietesPaiement) {
  const langue = useLangue();
  const cle = useContenus().config.stripePublique;
  if (!cle) return <PaiementSimule {...p} />;
  const moyens = p.moyens ?? "CARTE";
  return (
    <Elements
      key={moyens}
      stripe={stripeJs(cle, langue)}
      options={{
        mode: "payment",
        amount: p.total,
        currency: "eur",
        paymentMethodTypes: TYPES[moyens],
        appearance: {
          theme: "stripe",
          variables: { colorPrimary: "#0f1e3d", colorDanger: "#c73a2f", borderRadius: "10px", fontSizeBase: "16px" },
        },
      }}
    >
      <FormulaireStripe {...p} />
    </Elements>
  );
}

function FormulaireStripe(p: ProprietesPaiement) {
  const t = useT();
  const stripe = useStripe();
  const elements = useElements();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function confirmer() {
    if (!stripe || !elements) return;
    const e = p.verifier();
    if (e) return setErreur(e);
    setEnvoi(true);
    setErreur(null);
    const { error: errSaisie } = await elements.submit();
    if (errSaisie) {
      setErreur(errSaisie.message ?? t("Vérifiez vos informations de paiement."));
      return setEnvoi(false);
    }
    try {
      const o = await p.ouvrir(p.moyens ?? "CARTE");
      if (o.simulation) return allerVers(p.urlRetour(o.reference));
      const { error } = await stripe.confirmPayment({
        elements,
        clientSecret: o.clientSecret!,
        confirmParams: { return_url: p.urlRetour(o.reference) },
      });
      // On n'arrive ici qu'en cas d'erreur : sinon Stripe redirige vers la page de retour.
      setErreur(error?.message ?? t("Le paiement n'a pas abouti. Votre dossier est conservé."));
    } catch (x) {
      setErreur(x instanceof Error ? x.message : t("Le paiement n'a pas abouti. Votre dossier est conservé."));
    }
    setEnvoi(false);
  }

  const carte = (p.moyens ?? "CARTE") !== "KLARNA";
  return (
    <div className="paiement-integre">
      {carte && (
        <>
          <ExpressCheckoutElement
            options={{ buttonHeight: 52, paymentMethods: { applePay: "always", googlePay: "always", link: "never", paypal: "never", amazonPay: "never" } }}
            onClick={({ resolve }) => {
              const e = p.verifier();
              if (e) return setErreur(e);
              resolve();
            }}
            onConfirm={confirmer}
          />
          <p className="ou">{t("ou")}</p>
        </>
      )}
      <PaymentElement
        options={{
          layout: "tabs",
          wallets: { applePay: "never", googlePay: "never" },
          paymentMethodOrder: ["card", "klarna"],
        }}
      />
      {erreur && <p className="erreur">{erreur}</p>}
      <button className="btn btn-action large" disabled={envoi || !stripe} onClick={confirmer}>
        {envoi ? t("Paiement en cours…") : (p.libelle ?? t("Payer {montant}", { montant: formatEuros(p.total) }))}
      </button>
    </div>
  );
}

function PaiementSimule(p: ProprietesPaiement) {
  const t = useT();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <div className="paiement-integre">
      <p className="note">Mode développement : paiement simulé (aucune clé Stripe configurée).</p>
      {erreur && <p className="erreur">{erreur}</p>}
      <button
        className="btn btn-action large"
        disabled={envoi}
        onClick={async () => {
          const e = p.verifier();
          if (e) return setErreur(e);
          setEnvoi(true);
          try {
            const o = await p.ouvrir(p.moyens ?? "CARTE");
            allerVers(p.urlRetour(o.reference));
          } catch (x) {
            setErreur(x instanceof Error ? x.message : t("Une erreur est survenue."));
            setEnvoi(false);
          }
        }}
      >
        {p.libelle ?? t("Payer {montant}", { montant: formatEuros(p.total) })}
      </button>
    </div>
  );
}
