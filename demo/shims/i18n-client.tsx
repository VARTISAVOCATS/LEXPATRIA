"use client";
// Version démo du module de langue : le choix est gardé en mémoire (pas de cookie dans l'aperçu).
import { createContext, useContext } from "react";
import { LANGUES, NOMS_LANGUES, traduire, type Langue } from "../../src/i18n";

const Ctx = createContext<{ l: Langue; changer: (l: Langue) => void }>({ l: "fr", changer: () => {} });

export function FournisseurLangue({ langue, changer, children }: { langue: Langue; changer: (l: Langue) => void; children: React.ReactNode }) {
  return <Ctx.Provider value={{ l: langue, changer }}>{children}</Ctx.Provider>;
}
export const useLangue = () => useContext(Ctx).l;
export function useT() {
  const l = useContext(Ctx).l;
  return (texte: string, vars?: Record<string, string | number>) => traduire(l, texte, vars);
}
export function ChoixLangue() {
  const { l: actuelle, changer } = useContext(Ctx);
  return (
    <div className="choix-langue" role="group" aria-label="Langue">
      {LANGUES.map((l) => (
        <button key={l} lang={l} className={l === actuelle ? "actif" : ""} aria-pressed={l === actuelle} onClick={() => changer(l)}>
          {l === "fr" ? "FR" : l === "ar" ? "ع" : l.toUpperCase()}
          <span className="sr">{NOMS_LANGUES[l]}</span>
        </button>
      ))}
    </div>
  );
}
