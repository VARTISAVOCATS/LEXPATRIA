"use client";
// Écran de connexion par code reçu par e-mail (espaces client et cabinet).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

export default function Connexion({ espace, titre, intro }: { espace: "CLIENT" | "EQUIPE"; titre: string; intro: string }) {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [etape, setEtape] = useState<"email" | "code">("email");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [codeEssai, setCodeEssai] = useState<string | null>(null);

  async function appeler(corps: object) {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await fetch("/api/connexion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) });
      return { ok: r.ok, json: await r.json().catch(() => ({})) };
    } finally {
      setEnvoi(false);
    }
  }

  async function demander(e: React.FormEvent) {
    e.preventDefault();
    const r = await appeler({ etape: "demande", espace, email });
    if (!r.ok) return setErreur(t("Une erreur est survenue. Réessayez."));
    setCodeEssai(r.json.codeEssai ?? null);
    setEtape("code");
  }

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    const r = await appeler({ etape: "verification", espace, email, code });
    if (!r.ok) return setErreur(t("Code incorrect ou expiré."));
    router.refresh();
  }

  return (
    <div className="card connexion">
      <h1>{t(titre)}</h1>
      <p className="intro">{t(intro)}</p>
      {etape === "email" ? (
        <form onSubmit={demander} className="cx-form">
          <label htmlFor="cx-email">{t("Votre adresse e-mail")}</label>
          <input id="cx-email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn cta" disabled={envoi || !email}>
            {t("Recevoir mon code")}
          </button>
        </form>
      ) : (
        <form onSubmit={verifier} className="cx-form">
          <p>{t("Si cette adresse est enregistrée, un code à 6 chiffres vient de vous être envoyé. Il est valable 10 minutes.")}</p>
          {codeEssai && <p className="note warn">Environnement d&apos;essai : code {codeEssai}</p>}
          <label htmlFor="cx-code">{t("Code reçu")}</label>
          <input
            id="cx-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button className="btn cta" disabled={envoi || code.length !== 6}>
            {t("Se connecter")}
          </button>
          <button type="button" className="lien" onClick={() => { setEtape("email"); setCode(""); }}>
            {t("Changer d'adresse ou renvoyer un code")}
          </button>
        </form>
      )}
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
    </div>
  );
}
