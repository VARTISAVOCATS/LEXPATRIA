"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useT } from "@/i18n/client";
import { fichiersEnAttente } from "./depot/fichiers";

// Deux boutons de même rang dès le premier écran (cahier des charges, 4.1) :
// « Photographier ma décision » sur téléphone (« Importer ma décision » sur ordinateur) et « Exposer ma situation ».
// Sans attribut capture : le téléphone propose appareil photo, galerie ou fichiers.
export default function BoutonsAccueil() {
  const fichier = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const t = useT();
  return (
    <div className="ph-two">
      <button className="btn cta big ph-b" type="button" onClick={() => fichier.current?.click()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 15V4" />
          <path d="M7 9l5-5 5 5" />
          <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
        </svg>
        <span className="ph-lm">{t("Photographier ma décision")}</span>
        <span className="ph-ld">{t("Importer ma décision")}</span>
      </button>
      <Link className="btn cta big ph-b" href="/depot">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 5h16v11H8l-4 4z" />
          <path d="M8 9h8M8 12h5" />
        </svg>
        {t("Exposer ma situation")}
      </Link>
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
