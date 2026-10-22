// Logique serveur du paiement : offre, acceptation de la convention, intention de paiement Stripe,
// confirmation (idempotente) et attribution du dossier.

import { and, eq } from "drizzle-orm";
import type { Base } from "@/db";
import { clients, conventions, dossiers, paiements } from "@/db/schema";
import { texteConvention, VERSION_CONVENTION } from "@/lib/convention";
import { empreinteTexte, journaliser } from "@/lib/journal";
import { composerOffre, estRecoursPrealable, PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { stripe } from "@/lib/stripe";
import { attribuer } from "./attribution";
import { lireParametre } from "./parametres";

export const SEUIL_TROIS_FOIS = 10_000; // centimes

export async function charger(d: Base, dossierId: string) {
  const [dos] = await d.select().from(dossiers).where(eq(dossiers.id, dossierId));
  if (!dos) return null;
  const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
  return { dos, cli };
}

export async function offre(d: Base, dos: typeof dossiers.$inferSelect) {
  const code = dos.procedure as CodeProcedure;
  const tarifs = await lireParametre(d, "tarifs");
  const lignes = composerOffre(code, { urgence: dos.traitement === "URGENCE", avisPrealable: dos.avisPrealable }, tarifs);
  return { code, lignes, total: lignes.reduce((s, l) => s + l.montant, 0) };
}

const frDate = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : undefined);

export async function accepterConvention(
  d: Base,
  dos: typeof dossiers.$inferSelect,
  cli: typeof clients.$inferSelect,
  ip: string,
) {
  const { code, lignes, total } = await offre(d, dos);
  const texte = texteConvention({
    civilite: (cli.civilite as "MADAME" | "MONSIEUR") ?? undefined,
    prenom: cli.prenom ?? undefined,
    nom: cli.nom ?? undefined,
    reference: dos.reference,
    procedureLibelle: dos.avisPrealable ? "Avis écrit d'un avocat sur votre situation" : PROCEDURES[code].libelle,
    recoursPrealable: estRecoursPrealable(code) && !dos.avisPrealable,
    lignes,
    troisFois: total >= SEUIL_TROIS_FOIS,
    dateLimite: frDate(dos.dateLimite),
  });
  await d.insert(conventions).values({
    dossierId: dos.id,
    version: VERSION_CONVENTION,
    texte,
    empreinte: empreinteTexte(texte),
    ip,
    executionImmediate: true,
  });
  await journaliser(d, { dossierId: dos.id, acteur: "CLIENT", action: "CONVENTION_ACCEPTEE", details: { version: VERSION_CONVENTION, ip } });
}

/** Crée l'intention de paiement (Payment Element : carte, Apple Pay, Google Pay, Klarna). */
export async function creerIntention(d: Base, dos: typeof dossiers.$inferSelect, cli: typeof clients.$inferSelect, parTiers: boolean) {
  const { lignes, total } = await offre(d, dos);
  const s = await stripe();
  if (!s) {
    const [p] = await d.insert(paiements).values({ dossierId: dos.id, montant: total, lignes, parTiers, statut: "EN_ATTENTE" }).returning();
    return { simulation: true as const, paiementId: p.id, total };
  }
  const intent = await s.paymentIntents.create({
    amount: total,
    currency: "eur",
    // Moyens activés dans le tableau de bord Stripe : carte (Apple Pay, Google Pay) et Klarna.
    automatic_payment_methods: { enabled: true },
    receipt_email: parTiers ? undefined : (cli.email ?? undefined),
    description: `LEXPATRIA ${dos.reference}`,
    metadata: { dossierId: dos.id, reference: dos.reference, parTiers: parTiers ? "1" : "0" },
  });
  await d.insert(paiements).values({ dossierId: dos.id, stripeIntentId: intent.id, montant: total, lignes, parTiers, statut: "EN_ATTENTE" });
  return { simulation: false as const, clientSecret: intent.client_secret!, total };
}

/** Confirme un paiement (webhook Stripe ou simulation). Idempotent. */
export async function marquerPaye(d: Base, dossierId: string, ref: { intentId?: string; paiementId?: string; moyen?: string }) {
  const cond = ref.intentId ? eq(paiements.stripeIntentId, ref.intentId) : eq(paiements.id, ref.paiementId!);
  const maj = await d
    .update(paiements)
    .set({ statut: "PAYE", moyen: ref.moyen ?? null })
    .where(and(cond, eq(paiements.statut, "EN_ATTENTE")))
    .returning();
  if (!maj.length) return;
  const [dos] = await d
    .update(dossiers)
    .set({ statut: "PAYE", majLe: new Date() })
    .where(eq(dossiers.id, dossierId))
    .returning();
  await journaliser(d, { dossierId, acteur: "SYSTEME", action: "PAIEMENT_RECU", details: { montant: maj[0].montant, parTiers: maj[0].parTiers } });
  await attribuer(d, dossierId, dos.traitement === "URGENCE");
}
