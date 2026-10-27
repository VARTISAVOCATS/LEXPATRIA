// Paiement en trois fois sans frais, géré par le cabinet (Stripe) : acompte à la commande, puis deux prélèvements
// sur la carte utilisée. Partagé entre le parcours (affichage), la convention et le serveur (prélèvements).

export interface ReglesEcheancier {
  /** Montant à partir duquel le paiement en trois fois est proposé (centimes TTC). */
  seuil: number;
  /** Répartition en pourcentage des trois échéances (la première à la commande). */
  parts: [number, number, number];
  /** Jours entre deux échéances. */
  intervalleJours: number;
  /** Pénalité forfaitaire par échéance rejetée et non régularisée (centimes). */
  penalite: number;
  /** Délai de régularisation après un rejet, en jours, avant la pénalité. */
  regularisationJours: number;
  /** Nombre de tentatives de prélèvement automatique par échéance. */
  tentativesMax: number;
}

export const ECHEANCIER_DEFAUT: ReglesEcheancier = {
  seuil: 60_000,
  parts: [50, 25, 25],
  intervalleJours: 25,
  penalite: 1_500,
  regularisationJours: 8,
  tentativesMax: 3,
};

export interface Echeance {
  rang: 1 | 2 | 3;
  montant: number; // centimes
  le: string; // AAAA-MM-JJ
}

const jourIso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
const plusJours = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export const echelonnable = (total: number, r: ReglesEcheancier) => total >= r.seuil;

/** Les trois échéances : les deux dernières arrondies à l'euro, la première reçoit le reste. */
export function planEcheances(total: number, r: ReglesEcheancier, depuis = new Date()): Echeance[] {
  const jour = jourIso(depuis);
  const e2 = Math.floor((total * r.parts[1]) / 100 / 100) * 100;
  const e3 = Math.floor((total * r.parts[2]) / 100 / 100) * 100;
  return [
    { rang: 1, montant: total - e2 - e3, le: jour },
    { rang: 2, montant: e2, le: plusJours(jour, r.intervalleJours) },
    { rang: 3, montant: e3, le: plusJours(jour, 2 * r.intervalleJours) },
  ];
}

/** La carte doit rester valable jusqu'à la dernière échéance (fin du mois d'expiration incluse). */
export function carteCouvre(expMois: number, expAnnee: number, derniereEcheance: string): boolean {
  const finValidite = `${expAnnee}-${String(expMois).padStart(2, "0")}-31`;
  return finValidite >= derniereEcheance;
}

export const dateCourte = (iso: string) => iso.split("-").reverse().join("/");
