// Routeur minimal de la démo (sans serveur) : l'adresse est gardée en mémoire.
import { useSyncExternalStore } from "react";

let chemin = "/";
const abonnes = new Set<() => void>();
/** Espaces client et cabinet : maquette complète validée, publiée à côté (espaces.html). */
export function ouvrirEspace(vue: "client" | "cabinet") {
  window.location.href = `espaces.html#${vue}`;
}
export function naviguer(href: string) {
  if (href.startsWith("/espace")) return ouvrirEspace("client");
  chemin = href.startsWith("/") ? href : "/" + href;
  window.scrollTo(0, 0);
  abonnes.forEach((f) => f());
}
export function useChemin() {
  return useSyncExternalStore(
    (f) => (abonnes.add(f), () => abonnes.delete(f)),
    () => chemin,
    () => chemin,
  );
}
export const cheminCourant = () => chemin;
