// Pays de résidence (codes ISO 3166-1 alpha-2). Les libellés sont produits dans la langue de l'écran par le navigateur (Intl.DisplayNames).

export const PAYS = ["AF", "ZA", "AL", "DZ", "DE", "AD", "AO", "AG", "SA", "AR", "AM", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BE", "BZ", "BJ", "BT", "BY", "MM", "BO", "BA", "BW", "BR", "BN", "BG", "BF", "BI", "KH", "CM", "CA", "CV", "CF", "CL", "CN", "CY", "CO", "KM", "CG", "CD", "KR", "KP", "CR", "CI", "HR", "CU", "DK", "DJ", "DM", "EG", "AE", "EC", "ER", "ES", "EE", "SZ", "US", "ET", "FJ", "FI", "FR", "GA", "GM", "GE", "GH", "GR", "GD", "GT", "GN", "GQ", "GW", "GY", "HT", "HN", "HU", "IN", "ID", "IQ", "IR", "IE", "IS", "IL", "IT", "JM", "JP", "JO", "KZ", "KE", "KG", "KI", "XK", "KW", "LA", "LS", "LV", "LB", "LR", "LY", "LI", "LT", "LU", "MK", "MG", "MY", "MW", "MV", "ML", "MT", "MA", "MH", "MU", "MR", "MX", "FM", "MD", "MC", "MN", "ME", "MZ", "NA", "NR", "NP", "NI", "NE", "NG", "NO", "NZ", "OM", "UG", "UZ", "PK", "PW", "PS", "PA", "PG", "PY", "NL", "PE", "PH", "PL", "PT", "QA", "RO", "GB", "RU", "RW", "KN", "SM", "VC", "LC", "SB", "SV", "WS", "ST", "SN", "RS", "SC", "SL", "SG", "SK", "SI", "SO", "SD", "SS", "LK", "SE", "CH", "SR", "SY", "TJ", "TZ", "TD", "CZ", "TH", "TL", "TG", "TO", "TT", "TN", "TM", "TR", "TV", "UA", "UY", "VU", "VA", "VE", "VN", "YE", "ZM", "ZW", "GP", "MQ", "GF", "RE", "YT", "PM", "NC", "PF", "WF", "BL", "MF", "HK", "MO", "TW"] as const;

/** États membres de l'Union européenne. */
export const UNION_EUROPEENNE = new Set<string>(["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"]);

export function nomPays(code: string, langue = "fr"): string {
  try {
    return new Intl.DisplayNames([langue], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export interface AdressePostale {
  adresse?: string | null;
  codePostal?: string | null;
  ville?: string | null;
  pays?: string | null;
}

/** Adresse exigée avant le paiement : rue, ville, pays ; code postal à 5 chiffres en France. */
export function adresseComplete(a: AdressePostale): boolean {
  if (!a.adresse || a.adresse.trim().length < 5 || !a.ville || a.ville.trim().length < 2 || !a.pays || !(PAYS as readonly string[]).includes(a.pays)) return false;
  if (a.pays === "FR") return /^\d{5}$/.test((a.codePostal ?? "").trim());
  return true;
}

/** Adresse sur une ou plusieurs lignes (actes, convention, facture). */
export function adresseEnLignes(a: AdressePostale, langue = "fr"): string[] {
  if (!adresseComplete(a)) return [];
  return [a.adresse!.trim(), `${(a.codePostal ?? "").trim()} ${a.ville!.trim()}`.trim(), ...(a.pays === "FR" ? [] : [nomPays(a.pays!, langue).toUpperCase()])];
}

/** TVA française applicable : client résidant dans l'Union européenne ou en outre-mer français. Ailleurs, prestation non soumise (article 259 B du CGI), même prix. */
/** Outre-mer français : même traitement qu'un client de métropole (TVA à 20 %), choix du cabinet. */
export const OUTRE_MER = new Set<string>(["GP", "MQ", "GF", "RE", "YT", "PM", "NC", "PF", "WF", "BL", "MF"]);

export function tvaApplicable(pays?: string | null): boolean {
  const p = pays || "FR";
  return UNION_EUROPEENNE.has(p) || OUTRE_MER.has(p);
}
export const MENTION_TVA_HORS_UE = "TVA non applicable, article 259 B du code général des impôts";
