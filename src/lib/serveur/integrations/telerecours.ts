// Télérecours : il n'existe pas d'interface de programmation ouverte aux avocats pour déposer une requête.
// La plateforme prépare donc le dépôt : une archive prête à charger dans Télérecours (requête attestée en PDF,
// pièces numérotées en PDF dont le nom commence par leur numéro d'ordre, pour l'inventaire automatique),
// puis enregistre le numéro de requête attribué par la juridiction.

import JSZip from "jszip";
import { and, eq } from "drizzle-orm";
import type { Base } from "@/db";
import { clients, dossiers, pieces } from "@/db/schema";
import { journaliser } from "@/lib/journal";
import { JURIDICTIONNELS, LIBELLES_MODELE, type CodeModele } from "@/lib/modeles";
import type { Dossier } from "../dossiers";
import { assembler, texteVersPdf } from "../pdf";
import { attestationValide, dernierActe } from "../poste";
import { envoyer } from "../notifications";
import type { Membre } from "../session";
import { lire, type FichierStocke } from "../stockage";

const nomPropre = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,'()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

/** Archive de dépôt Télérecours : requête + pièces numérotées dans l'ordre du bordereau. */
export async function paquetTelerecours(d: Base, dos: Dossier): Promise<{ ok: true; zip: Uint8Array; nom: string; ignores: string[] } | { ok: false; erreur: string }> {
  const acte = await dernierActe(d, dos.id);
  if (!acte || !JURIDICTIONNELS.includes(acte.type as CodeModele)) return { ok: false, erreur: "Aucun acte juridictionnel à déposer." };
  if (!(await attestationValide(d, acte))) return { ok: false, erreur: "Aucun dépôt sans attestation de l'avocat sur la dernière version de l'acte." };
  const zip = new JSZip();
  const libelle = LIBELLES_MODELE[acte.type as CodeModele] ?? acte.type;
  zip.file(`Requete - ${dos.reference}.pdf`, await texteVersPdf(acte.contenu, libelle));
  const lesPieces = (await d.select().from(pieces).where(and(eq(pieces.dossierId, dos.id), eq(pieces.manquante, false)))).sort(
    (a, b) => (a.numero ?? 999) - (b.numero ?? 999) || a.creeLe.getTime() - b.creeLe.getTime(),
  );
  const ignores: string[] = [];
  let n = 0;
  for (const p of lesPieces) {
    const fichiers = (p.fichiers as FichierStocke[]) ?? [];
    if (!fichiers.length) continue;
    // Un fichier illisible (format non convertible, fichier manquant) n'empêche pas de préparer le reste : il est signalé.
    const contenus = await Promise.all(fichiers.map(async (f) => ({ mime: f.mime, donnees: new Uint8Array(await lire(f.cle)) }))).catch(() => null);
    const pdf = contenus ? await assembler(contenus).catch(() => null) : null;
    if (!pdf) {
      ignores.push(p.libelle);
      continue;
    }
    n++;
    zip.file(`Pieces/${n} - ${nomPropre(p.libelle)}.pdf`, pdf);
  }
  if (ignores.length)
    zip.file("A LIRE - pieces a ajouter a la main.txt", `Pièces non converties en PDF, à ajouter à la main dans Télérecours :\r\n${ignores.map((x) => `- ${x}`).join("\r\n")}\r\n`);
  return { ok: true, zip: await zip.generateAsync({ type: "uint8array" }), nom: `Telerecours-${dos.reference}.zip`, ignores };
}

/** Numéro d'enregistrement attribué par la juridiction : le dossier passe à « Recours enregistré ». */
export async function enregistrerNumero(d: Base, m: Membre, dos: Dossier, numero: string, date: string) {
  const num = numero.trim();
  if (!/^[0-9A-Za-z/ -]{5,20}$/.test(num)) return { ok: false as const, erreur: "Numéro de requête invalide." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false as const, erreur: "Date invalide." };
  if (!["DEPOSE", "ACTE_ATTESTE"].includes(dos.statut)) return { ok: false as const, erreur: "Indiquez d'abord que le recours est déposé." };
  if (dos.statut === "ACTE_ATTESTE" && !dos.dateLimiteVerifiee) return { ok: false as const, erreur: "Vérifiez d'abord la date limite." };
  await d.update(dossiers).set({ numeroRequete: num, statut: "ENREGISTRE", majLe: new Date() }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "REQUETE_ENREGISTREE", details: { numero: num, date, de: dos.statut } });
  const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
  if (cli?.email)
    await envoyer({
      canal: "EMAIL",
      destinataire: cli.email,
      sujet: "Votre dossier avance — LEXPATRIA",
      texte: `Bonjour,\n\nVotre dossier ${dos.reference} a franchi une nouvelle étape.\nRetrouvez le détail dans votre espace : ${process.env.URL_PUBLIQUE ?? "https://lexpatria.fr"}/espace\n\nLEXPATRIA Avocats`,
    });
  return { ok: true as const };
}
