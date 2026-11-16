"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useT } from "@/i18n/client";
import { useDictee } from "./depot/dictee";
import { fichiersEnAttente, recitEnAttente } from "./depot/fichiers";

// Premier écran : le récit se saisit directement sous le titre, puis la décision s'importe ou se photographie.
// Le récit et les fichiers passent au parcours de dépôt en mémoire, sans rechargement ni paramètre d'adresse.
export default function SaisieAccueil() {
  const t = useT();
  const router = useRouter();
  const fichier = useRef<HTMLInputElement>(null);
  const [recit, setRecit] = useState("");
  const [erreur, setErreur] = useState("");
  const dictee = useDictee(recit, setRecit, setErreur);

  function continuer() {
    recitEnAttente.texte = recit.trim();
    router.push("/depot?mode=recit");
  }

  return (
    <div className="acc-saisie">
      <div className="comp-row">
        <textarea
          dir="auto"
          rows={3}
          value={recit}
          placeholder={t("Écrivez ici, dans votre langue…")}
          aria-label={t("Quelle est votre situation ?")}
          onChange={(e) => setRecit(e.target.value)}
        />
        <button type="button" className={`mic ${dictee.actif ? "rec" : ""}`} onClick={dictee.basculer} aria-label={t("Dicter")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
      </div>
      <button type="button" className="btn cta big" disabled={!recit.trim()} onClick={continuer}>
        {t("Continuer")}
      </button>
      <span className="acc-saisie-s">{t("Toutes les langues, à l'écrit ou à la voix")}</span>
      {erreur && <p className="erreur" role="alert">{t(erreur)}</p>}
      <button type="button" className="btn dec-btn acc-dec" onClick={() => fichier.current?.click()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 15V4" />
          <path d="M7 9l5-5 5 5" />
          <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
        </svg>
        <span className="ph-lm">{t("Photographier ma décision")}</span>
        <span className="ph-ld">{t("Importer ma décision")}</span>
      </button>
      <input
        ref={fichier}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => {
          const liste = Array.from(e.target.files ?? []);
          if (!liste.length) return;
          fichiersEnAttente.splice(0, fichiersEnAttente.length, ...liste);
          router.push("/depot?mode=photo");
        }}
      />
    </div>
  );
}
