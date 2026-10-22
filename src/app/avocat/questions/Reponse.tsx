"use client";
// Réponse à une question du client : l'assistant propose, l'avocat corrige puis valide l'envoi.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function Reponse({ reference }: { reference: string }) {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState<"proposer" | "repondre" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const manquants = (texte.match(/XXX/g) ?? []).length;

  async function appel(action: "proposer" | "repondre") {
    setEnvoi(action);
    setErreur(null);
    const r = await fetch("/api/avocat/suivi", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference, action, contenu: action === "repondre" ? texte : undefined }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setEnvoi(null);
    if (!r?.ok) return setErreur(j?.erreur ?? "L'action a échoué.");
    if (action === "proposer") {
      setTexte(j.texte);
      setSource(j.source);
      setOuvert(true);
    } else {
      setTexte("");
      setOuvert(false);
      router.refresh();
    }
  }

  return (
    <div className="qr">
      <div className="cab-actions">
        <button className="btn sm" onClick={() => appel("proposer")} disabled={!!envoi}>
          {envoi === "proposer" ? "Préparation…" : ouvert ? "Proposer une autre réponse" : "Proposer une réponse"}
        </button>
        {!ouvert && (
          <button className="btn sm ghost" onClick={() => setOuvert(true)}>
            Rédiger moi-même
          </button>
        )}
      </div>
      {ouvert && (
        <>
          {source && (
            <p className="note">
              {source === "IA" ? "Proposition de l'assistant, à relire et corriger." : "Trame de réponse (assistant non configuré)."} Rien n&apos;est envoyé sans votre validation.
            </p>
          )}
          <textarea className="champ" rows={9} value={texte} onChange={(e) => setTexte(e.target.value)} aria-label="Réponse au client" />
          <div className="cab-actions">
            <button className="btn sm" onClick={() => appel("repondre")} disabled={!!envoi || !texte.trim() || manquants > 0}>
              {envoi === "repondre" ? "Envoi…" : "Valider et répondre"}
            </button>
            {manquants > 0 && <span className="pill warn">{manquants} mention(s) XXX à compléter</span>}
          </div>
        </>
      )}
      {erreur && <p className="erreur">{erreur}</p>}
    </div>
  );
}
