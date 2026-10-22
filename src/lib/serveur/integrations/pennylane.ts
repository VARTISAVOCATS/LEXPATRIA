// Pennylane (API v2) : une facture par paiement reçu, au nom du client (mention « réglée par un tiers » le cas échéant).
// Les prix de la plateforme sont TTC ; la facture porte le prix HT et la TVA à 20 %.
// L'adresse postale du client est exigée avant le paiement. Client résidant dans l'Union européenne ou en outre-mer : prix TTC, facture
// au prix HT avec TVA à 20 %. Hors Union : même prix, sans TVA (article 259 B du CGI), mention portée sur la facture.

import { and, eq, isNull } from "drizzle-orm";
import type { Base } from "@/db";
import { clients, dossiers, paiements } from "@/db/schema";
import { journaliser } from "@/lib/journal";
import { adresseComplete, MENTION_TVA_HORS_UE, tvaApplicable } from "@/lib/pays";
import { valeur } from "../connexions";
import { appelJson, messageErreur, tracer } from "./commun";

const BASE = "https://app.pennylane.com/api/external/v2";

async function api<T>(chemin: string, corps?: object): Promise<T> {
  const cle = await valeur("PENNYLANE_API_KEY");
  if (!cle) throw new Error("Pennylane n'est pas configuré.");
  return appelJson<T>(`${BASE}${chemin}`, {
    method: corps ? "POST" : "GET",
    headers: { authorization: `Bearer ${cle}`, accept: "application/json", ...(corps ? { "content-type": "application/json" } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  });
}

const euros = (centimes: number) => (centimes / 100).toFixed(2);
/** Prix unitaire HT (chaîne, deux décimales) à partir d'un prix TTC en centimes, TVA 20 %. */
export const prixHT = (ttcCentimes: number) => euros(Math.round(ttcCentimes / 1.2));

async function client(d: Base, clientId: string): Promise<number> {
  const [c] = await d.select().from(clients).where(eq(clients.id, clientId));
  if (c.pennylaneId) return Number(c.pennylaneId);
  const r = await api<{ id: number }>("/individual_customers", {
    first_name: c.prenom ?? "XXX",
    last_name: (c.nom ?? "XXX").toUpperCase(),
    emails: c.email ? [c.email] : [],
    external_reference: c.code,
    billing_address: { address: c.adresse ?? "", postal_code: c.codePostal ?? "", city: c.ville ?? "", country: c.pays ?? "FR" },
    payment_conditions: "upon_receipt",
  });
  await d.update(clients).set({ pennylaneId: String(r.id) }).where(eq(clients.id, c.id));
  return r.id;
}

export async function facturer(d: Base, paiementId: string) {
  const [p] = await d.select().from(paiements).where(eq(paiements.id, paiementId));
  if (!p || p.statut !== "PAYE" || p.pennylaneId) return;
  const [dos] = await d.select().from(dossiers).where(eq(dossiers.id, p.dossierId));
  try {
    const customerId = await client(d, dos.clientId);
    const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
    const brouillon = !adresseComplete(cli); // ne devrait pas arriver : l'adresse est exigée avant le paiement
    const tva = tvaApplicable(cli.pays);
    const jour = p.creeLe.toISOString().slice(0, 10);
    const lignes = (p.lignes as { libelle: string; montant: number }[]).map((l) => ({
      label: `${l.libelle} — dossier ${dos.reference} — réglé en ligne le ${jour.split("-").reverse().join("/")}${p.parTiers ? " (réglé par un tiers)" : ""}${tva ? "" : ` — ${MENTION_TVA_HORS_UE}`}`,
      quantity: 1,
      unit: "forfait",
      raw_currency_unit_price: tva ? prixHT(l.montant) : euros(l.montant),
      vat_rate: tva ? "FR_200" : "extracom",
    }));
    const f = await api<{ id: number }>("/customer_invoices", {
      customer_id: customerId,
      date: jour,
      deadline: jour,
      draft: brouillon,
      external_reference: `LEXPATRIA-${dos.reference}-${p.id}`,
      invoice_lines: lignes,
    });
    await d.update(paiements).set({ pennylaneId: String(f.id), pennylaneErreur: null }).where(eq(paiements.id, p.id));
    await journaliser(d, { dossierId: dos.id, acteur: "SYSTEME", action: "FACTURE_PENNYLANE", details: { paiementId: p.id, factureId: f.id } });
  } catch (e) {
    await d.update(paiements).set({ pennylaneErreur: messageErreur(e) }).where(eq(paiements.id, p.id));
    throw e;
  }
}

/** Tâche planifiée : paiements reçus sans facture (y compris les reprises après erreur). */
export async function synchroniserPennylane(d: Base) {
  if (!(await valeur("PENNYLANE_API_KEY"))) return { pennylane: "non configuré" };
  const aFacturer = await d.select({ id: paiements.id }).from(paiements).where(and(eq(paiements.statut, "PAYE"), isNull(paiements.pennylaneId))).limit(30);
  let faites = 0;
  let erreurs = 0;
  for (const p of aFacturer) {
    try {
      await facturer(d, p.id);
      faites++;
    } catch {
      erreurs++;
    }
  }
  await tracer(d, "pennylane", erreurs === 0, `${faites} facture(s) créée(s)${erreurs ? `, ${erreurs} en erreur (détail dans les paiements du dossier)` : ""}.`);
  return { pennylane: { factures: faites, erreurs } };
}
