// Traductions du site public et du parcours (cahier des charges : français, arabe, anglais, espagnol).
// La clé est le texte français lui-même : un texte absent d'un dictionnaire s'affiche en français.
// La convention d'honoraires, l'attestation et les actes restent en français (textes juridiques).

import ar from "./ar.json";
import en from "./en.json";
import es from "./es.json";

export const LANGUES = ["fr", "ar", "en", "es"] as const;
export type Langue = (typeof LANGUES)[number];
export const NOMS_LANGUES: Record<Langue, string> = { fr: "Français", ar: "العربية", en: "English", es: "Español" };

const DICTIONNAIRES: Record<Langue, Record<string, string>> = { fr: {}, ar, en, es };

export function estLangue(x: unknown): x is Langue {
  return typeof x === "string" && (LANGUES as readonly string[]).includes(x);
}

export function traduire(langue: Langue, texte: string, vars?: Record<string, string | number>): string {
  let s = DICTIONNAIRES[langue][texte] ?? texte;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export const sens = (l: Langue) => (l === "ar" ? "rtl" : "ltr");
export const COOKIE_LANGUE = "langue";
