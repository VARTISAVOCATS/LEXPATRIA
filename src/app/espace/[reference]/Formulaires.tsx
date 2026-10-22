"use client";
// Formulaires de l'espace client : écrire à son avocat, ajouter une pièce.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

export function FormMessage({ reference, api = "/api/espace/message" }: { reference: string; api?: string }) {
  const t = useT();
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const r = await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference, contenu: texte }) }).catch(() => null);
    setEnvoi(false);
    if (!r?.ok) return setErreur(t("Le message n'a pas pu être envoyé. Réessayez."));
    setTexte("");
    router.refresh();
  }
  return (
    <form className="esp-form" onSubmit={envoyer}>
      <label htmlFor="msg">{t("Votre message")}</label>
      <textarea id="msg" rows={4} maxLength={5000} value={texte} onChange={(e) => setTexte(e.target.value)} required />
      <div className="esp-form-b">
        <button className="btn cta" disabled={envoi || !texte.trim()}>
          {envoi ? t("Envoi…") : t("Envoyer")}
        </button>
      </div>
      {erreur && <p className="erreur">{erreur}</p>}
    </form>
  );
}

export function FormPiece({ reference, pieceId, libelleFixe, api = "/api/espace/pieces" }: { reference: string; pieceId?: string; libelleFixe?: string; api?: string }) {
  const t = useT();
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [libelle, setLibelle] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const fichiers = champ.current?.files;
    if (!fichiers?.length) return setErreur(t("Choisissez au moins un fichier."));
    const fd = new FormData();
    fd.set("reference", reference);
    if (pieceId) fd.set("pieceId", pieceId);
    fd.set("libelle", libelleFixe ?? libelle);
    for (const f of Array.from(fichiers)) fd.append("fichiers", f);
    setEnvoi(true);
    setErreur(null);
    const r = await fetch(api, { method: "POST", body: fd }).catch(() => null);
    setEnvoi(false);
    if (!r?.ok) {
      const j = await r?.json().catch(() => null);
      return setErreur(j?.erreur ? t(j.erreur) : t("L'envoi a échoué. Réessayez."));
    }
    setLibelle("");
    setOuvert(false);
    if (champ.current) champ.current.value = "";
    router.refresh();
  }
  if (!ouvert)
    return (
      <button className={`btn ${pieceId ? "sm" : ""}`} onClick={() => setOuvert(true)}>
        {pieceId ? t("Envoyer cette pièce") : t("Ajouter une pièce")}
      </button>
    );
  return (
    <form className="esp-form" onSubmit={envoyer}>
      {!libelleFixe && (
        <>
          <label htmlFor="pl">{t("De quelle pièce s'agit-il ?")}</label>
          <input id="pl" value={libelle} maxLength={200} onChange={(e) => setLibelle(e.target.value)} placeholder={t("Exemple : bulletins de salaire")} required />
        </>
      )}
      <label htmlFor="pf">{t("Fichiers (photo ou PDF, 20 Mo au plus chacun)")}</label>
      <input id="pf" ref={champ} type="file" multiple accept="image/*,application/pdf" />
      <div className="esp-form-b">
        <button type="button" className="btn ghost" onClick={() => setOuvert(false)}>
          {t("Annuler")}
        </button>
        <button className="btn cta" disabled={envoi}>
          {envoi ? t("Envoi…") : t("Envoyer")}
        </button>
      </div>
      {erreur && <p className="erreur">{erreur}</p>}
    </form>
  );
}
