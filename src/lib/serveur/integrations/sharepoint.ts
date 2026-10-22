// Classement des dossiers dans SharePoint (Microsoft Graph), en plus du stockage de la plateforme.
// Arborescence : <bibliothèque du site>/Lexpatria/<année>/<référence> <NOM Prénom>/
//   Pièces/<n> - <libellé>.<ext>, Actes/<type> v<n> (attesté).pdf, Convention d'honoraires (v…).pdf, Avis écrit.pdf
// Chaque document n'est déposé qu'une fois (table « archives ») ; une nouvelle version d'acte attestée est ajoutée à côté.

import { and, desc, eq, gte, inArray, notInArray } from "drizzle-orm";
import type { Base } from "@/db";
import { actes, archives, attestations, clients, conventions, dossiers, journal, pieces } from "@/db/schema";
import { empreinteTexte, journaliser } from "@/lib/journal";
import { LIBELLES_MODELE, type CodeModele } from "@/lib/modeles";
import { valeur } from "../connexions";
import type { Dossier } from "../dossiers";
import { texteVersPdf } from "../pdf";
import { lire, type FichierStocke } from "../stockage";
import { messageErreur, tracer } from "./commun";
import { graph, graphConfigure } from "./graph";

const nomPropre = (s: string) =>
  s
    .replace(/["*:<>?/\\|#%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
const chemin = (...parts: string[]) => parts.map((p) => encodeURIComponent(p)).join("/");

let driveCache: { site: string; drive: string } | null = null;

/** Bibliothèque de documents du site SharePoint saisi au back office (ex. https://vartis.sharepoint.com/sites/Lexpatria). */
async function bibliotheque(): Promise<string> {
  const site = await valeur("SHAREPOINT_SITE");
  if (!site) throw new Error("Adresse du site SharePoint absente (back office › Connexions).");
  if (driveCache?.site === site) return driveCache.drive;
  const u = new URL(site);
  const s = await graph<{ id: string }>(`/sites/${u.hostname}:${u.pathname.replace(/\/$/, "") || "/"}`);
  const dr = await graph<{ id: string }>(`/sites/${s.id}/drive`);
  driveCache = { site, drive: dr.id };
  return dr.id;
}

/** Dépôt d'un fichier ; au-delà de 4 Mo, session de chargement par tranches (exigence de Graph). */
async function deposer(drive: string, cheminFichier: string, donnees: Uint8Array): Promise<string> {
  if (donnees.byteLength <= 4 * 1024 * 1024) {
    const r = await graph<{ webUrl: string }>(`/drives/${drive}/root:/${cheminFichier}:/content`, { method: "PUT", body: donnees as BodyInit, brut: true, headers: { "content-type": "application/octet-stream" } });
    return r.webUrl;
  }
  const session = await graph<{ uploadUrl: string }>(`/drives/${drive}/root:/${cheminFichier}:/createUploadSession`, {
    method: "POST",
    body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }),
  });
  const TRANCHE = 5 * 320 * 1024; // multiple de 320 Kio
  let webUrl = "";
  for (let i = 0; i < donnees.byteLength; i += TRANCHE) {
    const morceau = donnees.slice(i, i + TRANCHE);
    const r = await fetch(session.uploadUrl, {
      method: "PUT",
      headers: { "content-range": `bytes ${i}-${i + morceau.byteLength - 1}/${donnees.byteLength}`, "content-length": String(morceau.byteLength) },
      body: morceau as BodyInit,
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) throw new Error(`SharePoint a refusé une tranche (${r.status}).`);
    const j = (await r.json().catch(() => ({}))) as { webUrl?: string };
    if (j.webUrl) webUrl = j.webUrl;
  }
  return webUrl;
}

interface Element {
  cle: string;
  nom: string; // chemin relatif au dossier
  produire: () => Promise<Uint8Array>;
}

async function elementsAClasser(d: Base, dos: Dossier): Promise<Element[]> {
  const deja = new Set((await d.select({ cle: archives.cle }).from(archives).where(eq(archives.dossierId, dos.id))).map((a) => a.cle));
  const liste: Element[] = [];
  for (const p of await d.select().from(pieces).where(and(eq(pieces.dossierId, dos.id), eq(pieces.manquante, false)))) {
    ((p.fichiers as FichierStocke[]) ?? []).forEach((f, i) => {
      const ext = (f.nom.match(/\.[a-z0-9]{1,5}$/i)?.[0] ?? "").toLowerCase();
      liste.push({
        cle: `piece:${p.id}:${i}`,
        nom: `Pièces/${p.numero ?? "0"} - ${nomPropre(p.libelle)}${(p.fichiers as FichierStocke[]).length > 1 ? ` (${i + 1})` : ""}${ext}`,
        produire: async () => new Uint8Array(await lire(f.cle)),
      });
    });
  }
  // Actes : chaque version attestée.
  const atts = await d
    .select({ acte: actes, att: attestations })
    .from(attestations)
    .innerJoin(actes, eq(actes.id, attestations.acteId))
    .where(eq(actes.dossierId, dos.id))
    .orderBy(desc(attestations.le));
  for (const { acte, att } of atts) {
    if (att.version !== acte.version || att.empreinte !== empreinteTexte(acte.contenu)) continue;
    const libelle = LIBELLES_MODELE[acte.type as CodeModele] ?? acte.type;
    liste.push({ cle: `acte:${acte.id}:v${acte.version}`, nom: `Actes/${nomPropre(libelle)} v${acte.version} (attesté).pdf`, produire: () => texteVersPdf(acte.contenu, libelle) });
  }
  for (const c of await d.select().from(conventions).where(eq(conventions.dossierId, dos.id)))
    liste.push({
      cle: `convention:${c.id}`,
      nom: `${c.type === "AVENANT_APPEL" ? "Avenant d'appel" : "Convention d'honoraires"} (version ${c.version}, ${c.accepteeLe.toISOString().slice(0, 10)}).pdf`,
      produire: () => texteVersPdf(`${c.texte}\n\nAcceptée le ${c.accepteeLe.toISOString()} depuis l'adresse ${c.ip}.\nEmpreinte SHA-256 : ${c.empreinte}`, "Convention d'honoraires"),
    });
  const pc = dos.priseEnCharge as { texte: string } | null;
  if (pc) liste.push({ cle: "prise-en-charge", nom: "Attestation de prise en charge.pdf", produire: () => texteVersPdf(pc.texte, "Attestation de prise en charge") });
  return liste.filter((e) => !deja.has(e.cle));
}

/** Classe dans SharePoint les documents du dossier qui n'y sont pas encore. */
export async function classerDossier(d: Base, dos: Dossier, par = "SYSTEME"): Promise<{ deposes: number; url: string | null }> {
  const drive = await bibliotheque();
  const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
  const racine = ["Lexpatria", String(dos.creeLe.getUTCFullYear()), nomPropre(`${dos.reference} ${(cli?.nom ?? "").toUpperCase()} ${cli?.prenom ?? ""}`)];
  const elements = await elementsAClasser(d, dos);
  for (const e of elements) {
    const c = chemin(...racine, ...e.nom.split("/"));
    await deposer(drive, c, await e.produire());
    await d.insert(archives).values({ dossierId: dos.id, cle: e.cle, chemin: [...racine, e.nom].join("/") });
  }
  let url = dos.sharepointUrl;
  if (!url) {
    const dossierSp = await graph<{ webUrl: string }>(`/drives/${drive}/root:/${chemin(...racine)}`).catch(() => null);
    url = dossierSp?.webUrl ?? null;
    if (url) await d.update(dossiers).set({ sharepointUrl: url }).where(eq(dossiers.id, dos.id));
  }
  if (elements.length) await journaliser(d, { dossierId: dos.id, acteur: par, action: "CLASSE_SHAREPOINT", details: { documents: elements.length } });
  return { deposes: elements.length, url };
}

/** Tâche planifiée : dossiers réglés modifiés récemment. */
export async function synchroniserSharepoint(d: Base) {
  if (!(await graphConfigure()) || !(await valeur("SHAREPOINT_SITE"))) return { sharepoint: "non configuré" };
  try {
    // Dossiers ayant eu une activité (pièce, acte, convention…) depuis deux jours.
    const actifs = d.select({ id: journal.dossierId }).from(journal).where(gte(journal.le, new Date(Date.now() - 2 * 86_400_000)));
    const recents = await d
      .select()
      .from(dossiers)
      .where(and(notInArray(dossiers.statut, ["PRE_DOSSIER", "ATTENTE_PROCHE", "APPEL_PROPOSE"]), inArray(dossiers.id, actifs)))
      .orderBy(desc(dossiers.majLe))
      .limit(25);
    let total = 0;
    for (const dos of recents) total += (await classerDossier(d, dos)).deposes;
    await tracer(d, "sharepoint", true, `${total} document(s) classé(s).`);
    return { sharepoint: total };
  } catch (e) {
    await tracer(d, "sharepoint", false, messageErreur(e));
    return { sharepoint: "erreur" };
  }
}
