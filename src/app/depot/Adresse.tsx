"use client";

// Saisie guidée de l'adresse postale : le pays d'abord ; en France, l'adresse se choisit dans une liste de suggestions
// (rue, code postal et ville remplis d'un geste) et la ville se déduit du code postal. Ailleurs, saisie libre.

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/client";

export interface ValeurAdresse {
  adresse: string;
  codePostal: string;
  ville: string;
  pays: string;
}

interface Suggestion {
  label: string;
  adresse: string;
  codePostal: string;
  ville: string;
}

export default function ChampsAdresse({
  valeur,
  changer,
  listePays,
}: {
  valeur: ValeurAdresse;
  changer: (v: Partial<ValeurAdresse>) => void;
  listePays: readonly (readonly [string, string])[];
}) {
  const t = useT();
  const fr = valeur.pays === "FR";
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [communes, setCommunes] = useState<string[]>([]);
  const choisie = useRef(false);

  // Suggestions d'adresses (France), après une courte pause de frappe.
  useEffect(() => {
    if (!fr || choisie.current || valeur.adresse.trim().length < 4) {
      setSuggestions([]);
      return;
    }
    const minuterie = setTimeout(async () => {
      const r = await fetch(`/api/adresse?q=${encodeURIComponent(valeur.adresse)}`).catch(() => null);
      const j = r?.ok ? ((await r.json()) as { suggestions?: Suggestion[] }) : null;
      setSuggestions(j?.suggestions ?? []);
    }, 250);
    return () => clearTimeout(minuterie);
  }, [valeur.adresse, fr]);

  // Communes du code postal (France) : une seule, la ville est remplie ; plusieurs, on choisit dans une liste.
  useEffect(() => {
    const cp = valeur.codePostal.trim();
    if (!fr || !/^\d{5}$/.test(cp)) {
      setCommunes([]);
      return;
    }
    let annule = false;
    (async () => {
      const r = await fetch(`/api/adresse?cp=${cp}`).catch(() => null);
      const j = r?.ok ? ((await r.json()) as { communes?: string[] }) : null;
      if (annule) return;
      const liste = j?.communes ?? [];
      setCommunes(liste);
      if (liste.length === 1 && valeur.ville !== liste[0]) changer({ ville: liste[0] });
      else if (liste.length > 1 && !liste.includes(valeur.ville)) changer({ ville: "" });
    })();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur.codePostal, fr]);

  return (
    <>
      <div className="f full">
        <label htmlFor="q_pays">{t("Pays de résidence")} *</label>
        <select id="q_pays" autoComplete="country" value={valeur.pays} onChange={(e) => changer({ pays: e.target.value })}>
          {listePays.map(([code, nom]) => (
            <option key={code} value={code}>
              {nom}
            </option>
          ))}
        </select>
      </div>
      <div className="f full adr-champ">
        <label htmlFor="q_adresse">{t("Adresse postale")} *</label>
        <input
          id="q_adresse"
          type="text"
          autoComplete="street-address"
          placeholder={fr ? t("Commencez à taper : numéro et rue") : ""}
          value={valeur.adresse}
          onFocus={() => setOuvert(true)}
          onBlur={() => setTimeout(() => setOuvert(false), 150)}
          onChange={(e) => {
            choisie.current = false;
            changer({ adresse: e.target.value });
          }}
        />
        {fr && ouvert && suggestions.length > 0 && (
          <div className="adr-sug" role="listbox">
            {suggestions.map((s) => (
              <button
                type="button"
                key={s.label}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  choisie.current = true;
                  changer({ adresse: s.adresse, codePostal: s.codePostal, ville: s.ville });
                  setSuggestions([]);
                  setOuvert(false);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        <span className="help">{t("Elle figure sur votre facture, votre convention d'honoraires et vos actes.")}</span>
      </div>
      <div className="f">
        <label htmlFor="q_cp">
          {t("Code postal")}
          {fr ? " *" : ""}
        </label>
        <input
          id="q_cp"
          type="text"
          inputMode={fr ? "numeric" : "text"}
          maxLength={fr ? 5 : 12}
          autoComplete="postal-code"
          value={valeur.codePostal}
          onChange={(e) => changer({ codePostal: fr ? e.target.value.replace(/\D/g, "") : e.target.value })}
        />
      </div>
      <div className="f">
        <label htmlFor="q_ville">{t("Ville")} *</label>
        {fr && communes.length > 1 ? (
          <select id="q_ville" value={valeur.ville} onChange={(e) => changer({ ville: e.target.value })}>
            <option value="">{t("Choisissez votre commune")}</option>
            {communes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : (
          <input id="q_ville" type="text" autoComplete="address-level2" value={valeur.ville} onChange={(e) => changer({ ville: e.target.value })} />
        )}
      </div>
    </>
  );
}
