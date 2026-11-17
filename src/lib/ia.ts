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

/** Liste lue avec tolérance : chaîne seule acceptée, éléments vides écartés, longueur plafonnée. */
export function listeTolerante(x: unknown, max: number): string[] {
  const a = Array.isArray(x) ? x : typeof x === "string" ? [x] : [];
  return a.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, max);
}

/** Message lisible pour l'avocat quand l'appel au modèle échoue (la cause réelle est journalisée côté serveur). */
export function messageErreurIA(e: unknown): string {
  const err = e as { status?: number; message?: string; error?: { error?: { type?: string; message?: string } } };
  const detail = `${err?.error?.error?.message ?? ""} ${err?.message ?? ""}`.toLowerCase();
  console.error("Appel IA en échec :", err?.status ?? "", err?.error?.error?.type ?? "", err?.error?.error?.message ?? err?.message ?? e, err?.status ? "" : (e as Error)?.stack ?? "");
  if (/credit balance|billing|crédit/.test(detail)) return "Crédit du compte Anthropic épuisé : rechargez-le sur console.anthropic.com (Billing), puis réessayez.";
  if (err?.status === 401 || /api key|authentication/.test(detail)) return "Clé Anthropic refusée : vérifiez-la dans Back office › Connexions.";
  if (err?.status === 404) return "Modèle d'IA introuvable : vérifiez le modèle indiqué dans Back office › Connexions.";
  if (err?.status === 429) return "Trop de demandes envoyées au service d'IA : réessayez dans une minute.";
  if (err?.status === 529 || err?.status === 503 || /overloaded/.test(detail)) return "Le service d'IA est momentanément surchargé : réessayez dans quelques minutes.";
  return "Le service d'intelligence artificielle n'a pas répondu. Réessayez.";
}

/** Pièces dont le contenu est transmis à l'IA : seulement celles qui fondent le recours (décision, notification,
 *  demande, procédure). Jamais les pièces d'identité ni les justificatifs personnels, dont seul le libellé est transmis. */
const TYPES_TRANSMIS = new Set(["DECISION", "ENVELOPPE", "DEMANDE_DEPOSEE", "RECOURS_FORME", "ECRITURES", "COURRIERS_TRIBUNAL"]);
const PERSONNEL = /passeport|identit|carte de s[ée]jour|titre de s[ée]jour|bulletin|salaire|naissance|scolarit|mariage|pacs|domicile|avis d'imposition|m[ée]dical|sant[ée]/i;
export function pieceTransmissibleIA(type: string, libelle: string): boolean {
  if (TYPES_TRANSMIS.has(type)) return true;
  if (/^(CAS|BLOCAGE)_\d+$/.test(type) || type === "BLOCAGE") return !PERSONNEL.test(libelle);
  // Pièce ajoutée depuis un espace : transmise seulement si son libellé désigne la décision ou sa notification.
  if (type === "AUTRE") return /d[ée]cision|notification|enveloppe|accus[ée] de r[ée]ception|jugement|arr[êe]t[ée]|oqtf|refus/i.test(libelle) && !PERSONNEL.test(libelle);
  return false;
}
