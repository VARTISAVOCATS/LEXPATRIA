// Lecture des fichiers d'un formulaire (photos et PDF, 20 Mo au plus par fichier).
import { TAILLE_MAX, typeAccepte } from "./stockage";

export async function lireFichiers(form: FormData): Promise<{ fichiers: { nom: string; mime: string; donnees: Buffer }[] } | { erreur: string; statut: number }> {
  const fichiers: { nom: string; mime: string; donnees: Buffer }[] = [];
  for (const f of form.getAll("fichiers")) {
    if (!(f instanceof File) || f.size === 0) continue;
    if (!typeAccepte(f.type)) return { erreur: "Format non accepté : photo ou PDF uniquement.", statut: 415 };
    if (f.size > TAILLE_MAX) return { erreur: "Fichier trop lourd (20 Mo au plus).", statut: 413 };
    fichiers.push({ nom: f.name, mime: f.type, donnees: Buffer.from(await f.arrayBuffer()) });
  }
  if (!fichiers.length) return { erreur: "Aucun fichier.", statut: 400 };
  if (fichiers.length > 10) return { erreur: "10 fichiers au plus par envoi.", statut: 400 };
  return { fichiers };
}
