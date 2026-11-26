// Pseudonymisation des données d'identité du client avant l'envoi au modèle d'IA (rédaction des actes, assistant).
// Le prénom, le nom, la date de naissance et l'adresse sont remplacés par des balises entre crochets ; la réponse du
// modèle est ensuite réidentifiée. Les pièces jointes (images, PDF) restent lisibles par le modèle : elles ne sont pas modifiées.

export interface Identite {
  prenom?: string | null;
  nom?: string | null;
  dateNaissance?: string | null; // AAAA-MM-JJ
  adresse?: string | null; // adresse postale sur une ligne
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Couples [valeur réelle, balise], du plus long au plus court pour éviter les remplacements partiels. */
export function correspondances(x: Identite): [string, string][] {
  const c: [string, string][] = [];
  const ajouter = (valeur: string | null | undefined, balise: string) => {
    const v = (valeur ?? "").trim();
    if (v.length >= 3 && !c.some(([w]) => w === v)) c.push([v, balise]);
  };
  const prenom = (x.prenom ?? "").trim();
  const nom = (x.nom ?? "").trim();
  if (prenom && nom) {
    ajouter(`${prenom} ${nom.toUpperCase()}`, "[PRENOM] [NOM_MAJ]");
    ajouter(`${prenom} ${nom}`, "[PRENOM] [NOM]");
  }
  ajouter(nom.toUpperCase(), "[NOM_MAJ]");
  ajouter(nom, "[NOM]");
  ajouter(prenom, "[PRENOM]");
  if (x.dateNaissance && /^\d{4}-\d{2}-\d{2}/.test(x.dateNaissance)) {
    const [a, m, j] = x.dateNaissance.slice(0, 10).split("-");
    ajouter(`${j}/${m}/${a}`, "[DATE_NAISSANCE]");
    ajouter(x.dateNaissance.slice(0, 10), "[DATE_NAISSANCE_ISO]");
    const jour = Number(j) === 1 ? "1er" : String(Number(j));
    ajouter(`${jour} ${MOIS[Number(m) - 1]} ${a}`, "[DATE_NAISSANCE_LONGUE]");
  }
  if (x.adresse) {
    ajouter(x.adresse, "[ADRESSE]");
    x.adresse.split(",").forEach((partie, i) => ajouter(partie, `[ADRESSE_${i + 1}]`));
  }
  return c.sort((a, b) => b[0].length - a[0].length);
}

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Remplace les données d'identité par leurs balises (mots entiers, casse respectée). */
export function pseudonymiser(texte: string, c: [string, string][]): string {
  return c.reduce((t, [v, b]) => t.replace(new RegExp(`(?<![\\p{L}\\p{N}])${echapper(v)}(?![\\p{L}\\p{N}])`, "gu"), b), texte);
}

/** Remet les données d'identité à la place des balises. */
export function reidentifier(texte: string, c: [string, string][]): string {
  // Balises composées d'abord (« [PRENOM] [NOM_MAJ] »), puis balises simples.
  const parBalise = new Map<string, string>();
  for (const [v, b] of c) if (!parBalise.has(b)) parBalise.set(b, v);
  return [...parBalise.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((t, [b, v]) => t.split(b).join(v), texte);
}

export const CONSIGNE_BALISES =
  " Les données d'identité du client sont remplacées par des balises entre crochets ([PRENOM], [NOM], [NOM_MAJ], [DATE_NAISSANCE], [DATE_NAISSANCE_LONGUE], [ADRESSE]…) : recopie-les exactement telles quelles là où l'identité doit figurer, sans les modifier ni les compléter.";
