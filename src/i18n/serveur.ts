import { cookies, headers } from "next/headers";
import { COOKIE_LANGUE, estLangue, traduire, type Langue } from ".";

/** Langue de la visite : choix enregistré, sinon langue du navigateur, sinon français. */
export async function langueServeur(): Promise<Langue> {
  const c = (await cookies()).get(COOKIE_LANGUE)?.value;
  if (estLangue(c)) return c;
  const h = (await headers()).get("accept-language") ?? "";
  const pref = h.split(",")[0]?.slice(0, 2).toLowerCase();
  return estLangue(pref) ? pref : "fr";
}

export async function tServeur() {
  const l = await langueServeur();
  return { l, t: (texte: string, vars?: Record<string, string | number>) => traduire(l, texte, vars) };
}
