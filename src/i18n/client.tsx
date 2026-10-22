"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext } from "react";
import { COOKIE_LANGUE, LANGUES, NOMS_LANGUES, traduire, type Langue } from ".";

const Ctx = createContext<Langue>("fr");

export function FournisseurLangue({ langue, children }: { langue: Langue; children: React.ReactNode }) {
  return <Ctx.Provider value={langue}>{children}</Ctx.Provider>;
}

export function useLangue() {
  return useContext(Ctx);
}

export function useT() {
  const l = useContext(Ctx);
  return (texte: string, vars?: Record<string, string | number>) => traduire(l, texte, vars);
}

export function ChoixLangue() {
  const actuelle = useLangue();
  const router = useRouter();
  return (
    <div className="choix-langue" role="group" aria-label="Langue">
      {LANGUES.map((l) => (
        <button
          key={l}
          lang={l}
          className={l === actuelle ? "actif" : ""}
          aria-pressed={l === actuelle}
          onClick={() => {
            try {
              document.cookie = `${COOKIE_LANGUE}=${l}; path=/; max-age=31536000; samesite=lax`;
            } catch {
              /* cookies indisponibles */
            }
            router.refresh();
          }}
        >
          {l === "fr" ? "FR" : l === "ar" ? "ع" : l.toUpperCase()}
          <span className="sr">{NOMS_LANGUES[l]}</span>
        </button>
      ))}
    </div>
  );
}
