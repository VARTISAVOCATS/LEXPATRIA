"use client";
import Link from "next/link";
import { useState } from "react";
import { useT } from "@/i18n/client";

export default function Accepter({ jeton }: { jeton: string }) {
  const t = useT();
  const [accepte, setAccepte] = useState(false);
  const [immediat, setImmediat] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function valider() {
    setEnvoi(true);
    setErreur(null);
    const r = await fetch("/api/pro-bono", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jeton, executionImmediate: immediat }) }).catch(() => null);
    setEnvoi(false);
    if (!r?.ok) {
      const j = await r?.json().catch(() => null);
      return setErreur(j?.erreur ?? t("L'envoi a échoué. Réessayez."));
    }
    setFait(true);
  }

  if (fait)
    return (
      <>
        <div className="succ">
          <span className="succ-i" aria-hidden>
            ✓
          </span>
          <div>
            <b>{t("Votre dossier est pris en charge.")}</b>
            <span>{t("Un e-mail de confirmation vous est envoyé.")}</span>
          </div>
        </div>
        <Link href="/espace" className="btn btn-action large">
          {t("Accéder à mon espace")}
        </Link>
      </>
    );

  return (
    <div className="pb-acc">
      <label className="chk p1-acc">
        <input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} />
        {t("J'accepte la convention d'intervention.")}
      </label>
      <label className="chk p1-acc">
        <input type="checkbox" checked={immediat} onChange={(e) => setImmediat(e.target.checked)} />
        {t("Je demande que l'avocat commence sans attendre la fin de mon délai de rétractation de 14 jours.")}
      </label>
      {erreur && <p className="erreur">{erreur}</p>}
      <button className="btn cta big" disabled={!accepte || envoi} onClick={valider}>
        {t("Accepter et confirmer")}
      </button>
    </div>
  );
}
