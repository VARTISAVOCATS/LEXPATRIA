// Limitation du nombre d'appels par adresse IP sur les routes publiques coûteuses (IA, création de dossiers).
// En mémoire : une seule instance de l'application tourne sur le serveur. Fenêtre glissante simple.
const fenetres = new Map<string, number[]>();

export function ipDe(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "inconnue";
}

/** Vrai si l'appel est autorisé ; faux si l'adresse a dépassé `max` appels sur `fenetreMs`. */
export function autoriser(cle: string, max: number, fenetreMs: number): boolean {
  const maintenant = Date.now();
  const recents = (fenetres.get(cle) ?? []).filter((t) => maintenant - t < fenetreMs);
  if (recents.length >= max) {
    fenetres.set(cle, recents);
    return false;
  }
  recents.push(maintenant);
  fenetres.set(cle, recents);
  // Nettoyage occasionnel pour borner la mémoire.
  if (fenetres.size > 5000) for (const [k, v] of fenetres) if (!v.some((t) => maintenant - t < fenetreMs)) fenetres.delete(k);
  return true;
}

/** Réponse 429 uniforme. */
export const tropDeDemandes = () =>
  Response.json({ erreur: "Trop de demandes en peu de temps. Réessayez dans quelques minutes." }, { status: 429, headers: { "retry-after": "300" } });
