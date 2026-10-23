// Lecture d'une réponse JSON du modèle, sans pré-remplissage de la réponse
// (les modèles récents refusent qu'on commence leur réponse à leur place).

/** Extrait l'objet JSON d'une réponse : du premier « { » au dernier « } », blocs ```json``` compris. */
export function extraireJson(blocs: { type: string; text?: string }[]): unknown {
  const texte = blocs.map((b) => (b.type === "text" ? (b.text ?? "") : "")).join("");
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut < 0 || fin < debut) throw new Error("Réponse du modèle sans objet JSON");
  return JSON.parse(texte.slice(debut, fin + 1));
}
