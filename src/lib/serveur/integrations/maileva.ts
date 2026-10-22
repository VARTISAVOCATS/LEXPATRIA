// Maileva (La Poste) : envoi des recours préalables, recours gracieux et mises en demeure en lettre recommandée
// avec avis de réception, à partir de la dernière version attestée de l'acte.
// API « registered_mail » v2 : création de l'envoi, ajout du document (PDF), ajout du destinataire, soumission.
// Sans paramètres Maileva : envoi simulé (aucun courrier ne part), signalé comme tel.

import { and, eq, inArray } from "drizzle-orm";
import type { Base } from "@/db";
import { dossiers, envois } from "@/db/schema";
import { journaliser } from "@/lib/journal";
import { LIBELLES_MODELE, type CodeModele } from "@/lib/modeles";
import { valeur } from "../connexions";
import type { Dossier } from "../dossiers";
import { texteVersPdf } from "../pdf";
import { attestationValide, dernierActe } from "../poste";
import type { Membre } from "../session";
import { appelJson, messageErreur, tracer } from "./commun";

/** Actes envoyés par courrier (les autres se déposent au tribunal par Télérecours). */
export const ACTES_COURRIER: CodeModele[] = ["RAPO_VISA", "RAPO_NATURALISATION", "RECOURS_GRACIEUX", "MISE_EN_DEMEURE"];

const EXPEDITEUR = ["SELARL VARTIS Avocats", "LEXPATRIA Avocats", "222 boulevard Saint-Germain", "75007 Paris"];

async function config() {
  const [id, secret, login, mdp, env] = await Promise.all(["MAILEVA_CLIENT_ID", "MAILEVA_CLIENT_SECRET", "MAILEVA_LOGIN", "MAILEVA_MOT_DE_PASSE", "MAILEVA_ENVIRONNEMENT"].map(valeur));
  if (!id || !secret || !login || !mdp) return null;
  const bac = env !== "production";
  return {
    id,
    secret,
    login,
    mdp,
    bac,
    auth: bac ? "https://connexion.sandbox.maileva.net/auth/realms/services/protocol/openid-connect/token" : "https://connexion.maileva.com/auth/realms/services/protocol/openid-connect/token",
    api: bac ? "https://api.sandbox.maileva.net/registered_mail/v2" : "https://api.maileva.com/registered_mail/v2",
  };
}

export async function jetonMaileva() {
  const c = await config();
  if (!c) throw new Error("Maileva n'est pas configuré.");
  const r = await appelJson<{ access_token: string }>(c.auth, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${Buffer.from(`${c.id}:${c.secret}`).toString("base64")}` },
    body: new URLSearchParams({ grant_type: "password", username: c.login, password: c.mdp }),
  });
  return { c, jeton: r.access_token };
}

/** Adresse du destinataire lue dans l'en-tête du courrier : le bloc qui suit celui de l'expéditeur. */
export function adresseDepuisActe(contenu: string): string {
  const blocs = contenu.split(/\n\s*\n/).map((b) => b.trim());
  return blocs[1] && !/^Lettre recommandée|^Objet/i.test(blocs[1]) ? blocs[1] : "";
}

export function lignesAdresse(adresse: string): string[] {
  return adresse
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6);
}

export async function envoyerRecommande(d: Base, m: Membre, dos: Dossier, adresse: string): Promise<{ ok: true; simule: boolean } | { ok: false; erreur: string }> {
  if (m.role !== "ASSOCIE" && m.role !== "SECRETARIAT" && !(m.role === "AVOCAT" && dos.avocatId === m.id)) return { ok: false, erreur: "Dossier attribué à un autre avocat." };
  const acte = await dernierActe(d, dos.id);
  if (!acte || !ACTES_COURRIER.includes(acte.type as CodeModele)) return { ok: false, erreur: "Cet acte ne s'envoie pas par courrier." };
  if (!(await attestationValide(d, acte))) return { ok: false, erreur: "Aucun envoi sans attestation de l'avocat sur la dernière version de l'acte." };
  const lignes = lignesAdresse(adresse);
  if (lignes.length < 2 || /XXX/.test(adresse)) return { ok: false, erreur: "Adresse du destinataire incomplète." };
  const [deja] = await d.select().from(envois).where(and(eq(envois.acteId, acte.id), inArray(envois.statut, ["ENVOYE", "SIMULE", "DISTRIBUE"])));
  if (deja) return { ok: false, erreur: "Cette version de l'acte a déjà été envoyée." };

  const c = await config();
  const titre = LIBELLES_MODELE[acte.type as CodeModele] ?? acte.type;
  if (!c) {
    if (process.env.NODE_ENV === "production" && !process.env.AUTORISER_SIMULATION) return { ok: false, erreur: "Maileva n'est pas configuré (back office › Connexions)." };
    await d.insert(envois).values({ dossierId: dos.id, acteId: acte.id, statut: "SIMULE", destinataire: lignes.join("\n"), par: m.id, message: "Envoi simulé : Maileva n'est pas configuré." });
    await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "RECOMMANDE_SIMULE", details: { acteId: acte.id } });
    await marquerDepose(d, dos, m.id);
    return { ok: true, simule: true };
  }
  try {
    const { jeton } = await jetonMaileva();
    const h = { authorization: `Bearer ${jeton}`, accept: "application/json" };
    const envoi = await appelJson<{ id: string }>(`${c.api}/sendings`, {
      method: "POST",
      headers: { ...h, "content-type": "application/json" },
      body: JSON.stringify({
        name: `${dos.reference} — ${titre}`.slice(0, 250),
        custom_id: dos.reference,
        acknowledgement_of_receipt: true,
        color_printing: false,
        duplex_printing: true,
        optional_address_sheet: true,
        ...Object.fromEntries(EXPEDITEUR.map((l, i) => [`sender_address_line_${i + 1}`, l])),
        sender_country_code: "FR",
      }),
    });
    const pdf = await texteVersPdf(acte.contenu, titre);
    const form = new FormData();
    form.append("document", new Blob([pdf as BlobPart], { type: "application/pdf" }), `${dos.reference}.pdf`);
    form.append("metadata", JSON.stringify({ priority: 1, name: `${dos.reference}.pdf` }));
    await appelJson(`${c.api}/sendings/${envoi.id}/documents`, { method: "POST", headers: h, body: form }, 60_000);
    await appelJson(`${c.api}/sendings/${envoi.id}/recipients`, {
      method: "POST",
      headers: { ...h, "content-type": "application/json" },
      body: JSON.stringify({ ...Object.fromEntries(lignes.map((l, i) => [`address_line_${i + 1}`, l])), country_code: "FR", custom_id: dos.reference }),
    });
    await appelJson(`${c.api}/sendings/${envoi.id}/submit`, { method: "POST", headers: h });
    await d.insert(envois).values({ dossierId: dos.id, acteId: acte.id, idExterne: envoi.id, statut: "ENVOYE", destinataire: lignes.join("\n"), par: m.id, message: c.bac ? "Environnement de test Maileva (aucun courrier réel)." : null });
    await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "RECOMMANDE_ENVOYE", details: { acteId: acte.id, maileva: envoi.id, test: c.bac } });
    // Le courrier envoyé vaut dépôt du recours préalable.
    await marquerDepose(d, dos, m.id);
    return { ok: true, simule: c.bac };
  } catch (e) {
    await d.insert(envois).values({ dossierId: dos.id, acteId: acte.id, statut: "ERREUR", destinataire: lignes.join("\n"), par: m.id, message: messageErreur(e) });
    return { ok: false, erreur: `Maileva a refusé l'envoi : ${messageErreur(e)}` };
  }
}

export async function envoisDuDossier(d: Base, dossierId: string) {
  return d.select().from(envois).where(eq(envois.dossierId, dossierId)).orderBy(envois.creeLe);
}

/** Tâche planifiée : statut des envois en cours (accepté, imprimé, distribué…). */
export async function suivreEnvois(d: Base) {
  const c = await config();
  if (!c) return { maileva: "non configuré" };
  const enCours = await d.select().from(envois).where(eq(envois.statut, "ENVOYE"));
  if (!enCours.length) return { maileva: 0 };
  try {
    const { jeton } = await jetonMaileva();
    for (const e of enCours) {
      const s = await appelJson<{ status?: string }>(`${c.api}/sendings/${e.idExterne}`, { headers: { authorization: `Bearer ${jeton}`, accept: "application/json" } });
      if (s.status && s.status !== "ACCEPTED" && s.status !== "PENDING")
        await d.update(envois).set({ message: `Statut Maileva : ${s.status}`, majLe: new Date() }).where(eq(envois.id, e.id));
    }
    await tracer(d, "maileva", true, `${enCours.length} envoi(s) suivi(s).`);
  } catch (err) {
    await tracer(d, "maileva", false, messageErreur(err));
  }
  return { maileva: enCours.length };
}

/** Après l'envoi, le recours préalable est déposé : mise à jour de l'étape du dossier. */
async function marquerDepose(d: Base, dos: Dossier, par: string) {
  if (["PRIS_EN_CHARGE", "EN_REDACTION", "ACTE_ATTESTE"].includes(dos.statut)) {
    await d.update(dossiers).set({ statut: "DEPOSE", majLe: new Date() }).where(eq(dossiers.id, dos.id));
    await journaliser(d, { dossierId: dos.id, acteur: par, action: "STATUT_MODIFIE", details: { de: dos.statut, vers: "DEPOSE", par: "MAILEVA" } });
  }
}
