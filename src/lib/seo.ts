// Référencement : adresse du site, fiche du cabinet en données structurées (schema.org), métadonnées communes.
// Les pages privées (dépôt, espace client, règlements) ne sont pas indexées.

import type { Metadata } from "next";

export const BASE = process.env.URL_PUBLIQUE ?? "https://lexpatria.fr";
export const NOM = "LEXPATRIA Avocats";

/** Métadonnées d'une page publique : titre, description, adresse canonique et aperçu de partage. */
export function meta(titre: string, description: string, chemin: string): Metadata {
  return {
    title: titre,
    description,
    alternates: { canonical: chemin },
    openGraph: { title: titre, description, url: chemin, siteName: NOM, locale: "fr_FR", type: "website", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: NOM }] },
    twitter: { card: "summary_large_image", title: titre, description },
  };
}

/** Pages privées : ni indexées ni suivies. */
export const PRIVE: Metadata["robots"] = { index: false, follow: false };

/** Le cabinet, au sens de schema.org (LegalService). */
export function cabinetLd(avocats: { nom: string; titre: string }[]) {
  return {
    "@type": "LegalService",
    "@id": `${BASE}/#cabinet`,
    name: NOM,
    legalName: "SELARL VARTIS Avocats",
    url: BASE,
    logo: `${BASE}/opengraph-image`,
    image: `${BASE}/opengraph-image`,
    description: "Cabinet d'avocats au barreau de Paris consacré au contentieux du droit des étrangers : OQTF, refus de titre de séjour, refus de visa, naturalisation, préfecture sans réponse.",
    address: { "@type": "PostalAddress", streetAddress: "222 boulevard Saint-Germain", postalCode: "75007", addressLocality: "Paris", addressCountry: "FR" },
    areaServed: { "@type": "Country", name: "France" },
    knowsLanguage: ["fr", "ar", "en", "es"],
    priceRange: "€€",
    taxID: "FR15937773885",
    knowsAbout: ["Droit des étrangers", "OQTF", "Titre de séjour", "Visa", "Naturalisation", "Contentieux administratif"],
    employee: avocats.map((a) => ({ "@type": "Person", name: a.nom.replace(/^Me\s+/, ""), jobTitle: a.titre.split(" · ")[0] })),
  };
}

export const ld = (donnees: object) => JSON.stringify({ "@context": "https://schema.org", ...donnees }).replace(/</g, "\\u003c");
