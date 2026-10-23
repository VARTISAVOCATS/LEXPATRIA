// Contenus et réglages modifiables depuis le back office (sans redéploiement).
// Chaque paramètre a une valeur par défaut dans le code ; la valeur enregistrée en base la remplace.
// Ce module est partagé (serveur et navigateur) : aucune dépendance serveur ici.

import { z } from "zod";
import { AVOCATS, FAQ } from "./accueil";
import { LIBELLES_DILIGENCE, TARIFS_DEFAUT, type Diligence } from "./procedures";

const DILIGENCES = Object.keys(TARIFS_DEFAUT) as Diligence[];

const schemaTarifs = z.object(
  Object.fromEntries(DILIGENCES.map((d) => [d, z.number().int().min(0).max(1_000_000)])) as Record<Diligence, z.ZodNumber>,
);
const schemaFaq = z
  .array(z.object({ q: z.string().trim().min(5).max(300), r: z.string().trim().min(5).max(2000) }))
  .min(1)
  .max(30);
const schemaAvocats = z
  .array(
    z.object({
      nom: z.string().trim().min(3).max(80),
      titre: z.string().trim().min(3).max(160),
      photo: z.string().max(300).nullable(),
    }),
  )
  .min(1)
  .max(20);
const schemaAccueil = z.object({
  titre: z.string().trim().min(5).max(160),
  sousTitre: z.string().trim().min(5).max(400),
});
const schemaDelais = z.object({
  acceptationNormaleH: z.number().int().min(1).max(48),
  acceptationUrgenceH: z.number().int().min(1).max(24),
});

const schemaRemuneration = z.object({
  acteHT: z.number().int().min(0).max(1_000_000), // centimes HT
});

export const ACCUEIL_DEFAUT = {
  titre: "Vous avez reçu une OQTF ou un refus de la préfecture ?",
  sousTitre:
    "Des avocats au barreau de Paris étudient votre situation et forment votre recours, devant l'administration ou le tribunal.",
};

export const PARAMETRES = {
  tarifs: {
    libelle: "Honoraires TTC",
    aide: "Prix de chaque diligence, toutes taxes comprises.",
    schema: schemaTarifs,
    defaut: TARIFS_DEFAUT,
    public: true,
  },
  faq: {
    libelle: "Questions fréquentes",
    aide: "Questions et réponses affichées sur l'accueil et dans « Besoin d'aide ? ».",
    schema: schemaFaq,
    defaut: FAQ,
    public: true,
  },
  avocats: {
    libelle: "Avocats présentés sur le site",
    aide: "Nom, titre et photo (chemin d'une image du site, ou vide).",
    schema: schemaAvocats,
    defaut: AVOCATS,
    public: true,
  },
  accueil: {
    libelle: "Accueil : titre et sous-titre",
    aide: "Premier texte vu par le visiteur.",
    schema: schemaAccueil,
    defaut: ACCUEIL_DEFAUT,
    public: true,
  },
  delais: {
    libelle: "Délais d'acceptation d'un dossier par l'avocat (heures ouvrées)",
    aide: "Au-delà, le dossier est réattribué (lot 3).",
    schema: schemaDelais,
    defaut: { acceptationNormaleH: 2, acceptationUrgenceH: 1 },
    public: false,
  },
  remuneration: {
    libelle: "Rémunération à l'acte (HT)",
    aide: "Montant versé à l'avocat rémunéré à l'acte pour chaque acte attesté. Un acte compte une fois, même s'il est modifié et attesté à nouveau ; les avis écrits ne sont pas comptés.",
    schema: schemaRemuneration,
    defaut: { acteHT: 20_000 },
    public: false,
  },
} as const;

export type CleParametre = keyof typeof PARAMETRES;
export type ValeurParametre<K extends CleParametre> = z.infer<(typeof PARAMETRES)[K]["schema"]>;
export const CLES_PARAMETRES = Object.keys(PARAMETRES) as CleParametre[];

/** Configuration publique (aucun secret) : clé publiable Stripe, mesure d'audience, téléphone. */
export interface ConfigPublique {
  stripePublique?: string;
  matomoUrl?: string;
  matomoSite?: string;
  metaPixel?: string;
  tiktokPixel?: string;
  googleAds?: string;
  telephoneCabinet?: string;
}

export interface ContenusPublics {
  config: ConfigPublique;
  tarifs: Record<Diligence, number>;
  faq: { q: string; r: string }[];
  avocats: { nom: string; titre: string; photo: string | null }[];
  accueil: { titre: string; sousTitre: string };
}

export const CONTENUS_DEFAUT: ContenusPublics = {
  // Repli (démonstration sans serveur) : variables publiques intégrées à la construction.
  config: {
    stripePublique: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    telephoneCabinet: process.env.NEXT_PUBLIC_TELEPHONE_CABINET,
  },
  tarifs: TARIFS_DEFAUT,
  faq: FAQ,
  avocats: AVOCATS,
  accueil: ACCUEIL_DEFAUT,
};

/** Tous les textes d'une valeur (pour le filtre déontologique). */
export function textesDe(valeur: unknown): string[] {
  if (typeof valeur === "string") return [valeur];
  if (Array.isArray(valeur)) return valeur.flatMap(textesDe);
  if (valeur && typeof valeur === "object") return Object.values(valeur).flatMap(textesDe);
  return [];
}

export { DILIGENCES, LIBELLES_DILIGENCE };
