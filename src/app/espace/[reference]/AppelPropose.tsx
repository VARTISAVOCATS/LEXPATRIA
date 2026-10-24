"use client";
// Espace client : l'avocat propose l'appel. Le client lit l'avenant, l'accepte et règle, ou renonce.
import { useState } from "react";
import { useRouter } from "next/navigation";
import PaiementIntegre from "@/app/depot/PaiementIntegre";
import { useLangue, useT } from "@/i18n/client";
import { formatEuros } from "@/lib/procedures";

export function AppelPropose({ reference, total, troisFois, resume, texte, horsUE }: { reference: string; total: number; troisFois: boolean; resume: string[]; texte: string; horsUE?: boolean }) {
  const t = useT();
  const langue = useLangue();
  const router = useRouter();
  const [caseConvention, setCaseConvention] = useState(false);
  const [caseExecution, setCaseExecution] = useState(false);
  const [renonce, setRenonce] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function renoncer() {
    const r = await fetch("/api/espace/appel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, action: "renoncer" }) }).catch(() => null);
    if (!r?.ok) return setErreur(t("L'action a échoué. Réessayez."));
    router.refresh();
  }

  return (
    <div className="esp-appel">
      <div className="recap">
        <span>{horsUE ? t("Honoraires (TVA non applicable)") : t("Honoraires TTC")}</span> <b>{formatEuros(total)}</b>
      </div>
      <div className="p1-conv">
        <b>{t("Avenant d'appel, en résumé")}</b>
        <ul>
          {langue !== "fr" && <li>{t("La convention d'honoraires est rédigée en français.")}</li>}
          {resume.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <details className="esp-conv">
          <summary>{t("Lire l'avenant complet")}</summary>
          <pre>{texte}</pre>
        </details>
      </div>
      <p className="lx-aj">
        <b>{t("Aide juridictionnelle non acceptée.")}</b> {t("Les honoraires sont ceux indiqués ci-dessus.")}
      </p>
      <label className="chk p1-acc">
        <input type="checkbox" checked={caseConvention} onChange={(e) => setCaseConvention(e.target.checked)} />
        {t("J'accepte l'avenant d'appel à la convention d'honoraires.")}
      </label>
      <label className="chk p1-acc">
        <input type="checkbox" checked={caseExecution} onChange={(e) => setCaseExecution(e.target.checked)} />
        {t("Je demande que l'avocat commence sans attendre la fin de mon délai de rétractation de 14 jours.")}
      </label>
      <PaiementIntegre
        total={total}
        moyens={troisFois ? "CARTE_KLARNA" : "CARTE"}
        verifier={() => (!caseConvention || !caseExecution ? t("Cochez les deux cases ci-dessus pour payer.") : null)}
        ouvrir={async (moyens) => {
          const r = await fetch("/api/espace/appel", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ reference, action: "payer", accepteConvention: true, executionImmediate: true, moyens }),
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.erreur);
          return j;
        }}
        urlRetour={() => `${window.location.origin}/espace/${reference}`}
      />
      <p className="p1-sec">{t("Paiement sécurisé 3-D Secure (Stripe)")}</p>
      <div className="esp-renonce">
        {!renonce ? (
          <button className="btn ghost sm" onClick={() => setRenonce(true)}>
            {t("Je ne souhaite pas faire appel")}
          </button>
        ) : (
          <>
            <span>{t("Confirmez-vous ne pas vouloir faire appel ? Votre avocat en sera informé.")}</span>
            <button className="btn sm" onClick={renoncer}>
              {t("Confirmer")}
            </button>
            <button className="btn ghost sm" onClick={() => setRenonce(false)}>
              {t("Annuler")}
            </button>
          </>
        )}
      </div>
      {erreur && <p className="erreur">{erreur}</p>}
      <p className="p1-med">
        {t("Contestation des honoraires : Bâtonnier de l'Ordre des avocats de Paris.")} {t("En cas de litige, vous pouvez saisir le médiateur de la consommation de la profession d'avocat.")}
      </p>
    </div>
  );
}
