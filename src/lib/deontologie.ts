// Filtre de publication (cahier des charges, sections 3 et 14.1).
// Appliqué à tout texte publié sur le site et à tout texte généré par l'IA à destination du public ou du client.

const INTERDITS: { motif: string; re: RegExp }[] = [
  { motif: "gratuit", re: /\bgratuit(e|s|es|ement)?\b/i },
  { motif: "offert", re: /\boffert(e|s|es)?\b/i },
  { motif: "sans frais", re: /\bsans\s+frais\b/i },
  { motif: "garanti", re: /\bgaranti(e|s|es)?\b/i },
  { motif: "100 %", re: /\b100\s?%/ },
  { motif: "spécialiste", re: /\bsp[ée]cialist(e|es)\b/i },
  { motif: "avocats du barreau", re: /\bavocats?\s+du\s+barreau\b/i },
  { motif: "jours ouvrables", re: /\bouvrables?\b/i },
  { motif: "remboursé si", re: /\brembours[ée]s?\s+si\b/i },
  { motif: "l'avocat n'est pas obligatoire", re: /avocat\s+n['’]est\s+pas\s+obligatoire/i },
];

export interface Infraction {
  motif: string;
  extrait: string;
}

export function controlerTexte(texte: string): Infraction[] {
  const res: Infraction[] = [];
  for (const { motif, re } of INTERDITS) {
    const m = texte.match(re);
    if (m) {
      const i = m.index ?? 0;
      res.push({ motif, extrait: texte.slice(Math.max(0, i - 30), i + m[0].length + 30) });
    }
  }
  return res;
}

export function texteConforme(texte: string): boolean {
  return controlerTexte(texte).length === 0;
}
