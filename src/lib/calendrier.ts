// Calendrier français : jours fériés, jours et heures ouvrés.
// Toutes les dates sont manipulées en heure de Paris, au jour près (sans heure),
// sauf pour les heures ouvrées.

const MS_JOUR = 86_400_000;

/** Date « civile » sans heure, en UTC minuit, pour éviter les décalages d'été/hiver. */
export function jour(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

export function versJour(date: Date): Date {
  // Ramène une date-heure à son jour civil à Paris.
  const p = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return jour(get("year"), get("month"), get("day"));
}

export function ajouterJours(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_JOUR);
}

/** Ajoute n mois civils ; si le jour n'existe pas (31 → 30), retient le dernier jour du mois. */
export function ajouterMois(d: Date, n: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const cible = new Date(Date.UTC(y, m, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth(), Math.min(d.getUTCDate(), dernier)));
}

export function ecartJours(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_JOUR);
}

function paques(annee: number): Date {
  // Algorithme de Meeus / Jones / Butcher.
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jourP = ((h + l - 7 * m + 114) % 31) + 1;
  return jour(annee, mois, jourP);
}

const cacheFeries = new Map<number, Set<number>>();

export function joursFeries(annee: number): Set<number> {
  const enCache = cacheFeries.get(annee);
  if (enCache) return enCache;
  const p = paques(annee);
  const liste = [
    jour(annee, 1, 1),
    ajouterJours(p, 1), // lundi de Pâques
    jour(annee, 5, 1),
    jour(annee, 5, 8),
    ajouterJours(p, 39), // Ascension
    ajouterJours(p, 50), // lundi de Pentecôte
    jour(annee, 7, 14),
    jour(annee, 8, 15),
    jour(annee, 11, 1),
    jour(annee, 11, 11),
    jour(annee, 12, 25),
  ];
  const s = new Set(liste.map((d) => d.getTime()));
  cacheFeries.set(annee, s);
  return s;
}

export function estFerie(d: Date): boolean {
  return joursFeries(d.getUTCFullYear()).has(d.getTime());
}

/** Jour ouvré : du lundi au vendredi, hors jours fériés. */
export function estOuvre(d: Date): boolean {
  const j = d.getUTCDay();
  return j !== 0 && j !== 6 && !estFerie(d);
}

/** Nombre de jours ouvrés strictement après `depuis`, jusqu'à `jusqua` inclus. */
export function joursOuvresEntre(depuis: Date, jusqua: Date): number {
  let n = 0;
  for (let d = ajouterJours(depuis, 1); d.getTime() <= jusqua.getTime(); d = ajouterJours(d, 1)) {
    if (estOuvre(d)) n++;
  }
  return n;
}

export interface HeuresOuvrees {
  debut: number; // heure d'ouverture, 9
  fin: number; // heure de fermeture, 19
}

export const HEURES_OUVREES_DEFAUT: HeuresOuvrees = { debut: 9, fin: 19 };

function heureParis(date: Date): { jour: Date; minutes: number } {
  const p = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const h = Number(p.find((x) => x.type === "hour")!.value);
  const m = Number(p.find((x) => x.type === "minute")!.value);
  return { jour: versJour(date), minutes: h * 60 + m };
}

/**
 * Échéance en heures ouvrées : ajoute `heures` heures ouvrées à `depart`.
 * Rend un repère { jour, minutes } à Paris (le dossier stocke l'instant, l'affichage reste en heure de Paris).
 */
export function ajouterHeuresOuvrees(
  depart: Date,
  heures: number,
  h: HeuresOuvrees = HEURES_OUVREES_DEFAUT,
): { jour: Date; minutes: number } {
  let { jour: j, minutes } = heureParis(depart);
  let reste = heures * 60;
  const ouverture = h.debut * 60;
  const fermeture = h.fin * 60;
  if (!estOuvre(j) || minutes >= fermeture) {
    do j = ajouterJours(j, 1);
    while (!estOuvre(j));
    minutes = ouverture;
  } else if (minutes < ouverture) {
    minutes = ouverture;
  }
  while (reste > 0) {
    const dispo = fermeture - minutes;
    if (reste <= dispo) {
      minutes += reste;
      reste = 0;
    } else {
      reste -= dispo;
      do j = ajouterJours(j, 1);
      while (!estOuvre(j));
      minutes = ouverture;
    }
  }
  return { jour: j, minutes };
}

/** Instant UTC correspondant à un jour civil et une heure (en minutes) à Paris, heure d'été comprise. */
export function instantParis(j: Date, minutes: number): Date {
  const naif = new Date(j.getTime() + minutes * 60_000);
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).formatToParts(naif);
  const hParis = Number(p.find((x) => x.type === "hour")!.value);
  const decalage = (hParis - naif.getUTCHours() + 24) % 24; // 1 en hiver, 2 en été
  return new Date(naif.getTime() - decalage * 3_600_000);
}
