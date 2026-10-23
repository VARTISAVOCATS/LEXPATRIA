// Logique serveur du paiement : offre, acceptation de la convention, intention de paiement Stripe,
// confirmation (idempotente) et attribution du dossier.

import { estLangue, traduire } from "@/i18n";
import { and, eq } from "drizzle-orm";
import type { Base } from "@/db";
import { clients, conventions, dossiers, paiements, utilisateurs } from "@/db/schema";
import { ajouterHeuresOuvrees, instantParis } from "@/lib/calendrier";
import { adresseEnLignes, tvaApplicable } from "@/lib/pays";
import { texteConvention, VERSION_CONVENTION, type DonneesConvention } from "@/lib/convention";
import { empreinteTexte, journaliser } from "@/lib/journal";
import { composerOffre, estRecoursPrealable, LIBELLES_DILIGENCE, PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { signer } from "@/lib/jeton";
import { stripe } from "@/lib/stripe";
import { attribuer } from "./attribution";
import { valeur } from "./connexions";
import { facturer } from "./integrations/pennylane";
import { envoyer } from "./notifications";
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
  // Appel : forfait d'appel seul, sans majoration d'urgence.
  const lignes = dos.dossierParentId
    ? [{ diligence: "APPEL" as const, libelle: LIBELLES_DILIGENCE.APPEL, montant: tarifs.APPEL }]
    : composerOffre(code, { urgence: dos.traitement === "URGENCE", avisPrealable: dos.avisPrealable }, tarifs);
  return { code, lignes, total: lignes.reduce((s, l) => s + l.montant, 0) };
}

const frDate = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : undefined);

/** Données de la convention (ou de l'avenant d'appel) d'un dossier, pour l'afficher puis l'archiver à l'identique. */
export async function donneesConvention(d: Base, dos: typeof dossiers.$inferSelect, cli: typeof clients.$inferSelect): Promise<DonneesConvention> {
  const { code, lignes, total } = await offre(d, dos);
  const parent = dos.dossierParentId ? (await d.select().from(dossiers).where(eq(dossiers.id, dos.dossierParentId)))[0] : null;
  return {
    civilite: (cli.civilite as "MADAME" | "MONSIEUR") ?? undefined,
    prenom: cli.prenom ?? undefined,
    nom: cli.nom ?? undefined,
    adresse: adresseEnLignes(cli).join(", ") || undefined,
    horsUE: !tvaApplicable(cli.pays),
    reference: dos.reference,
    procedureLibelle: parent
      ? `Appel devant la cour administrative d'appel du jugement rendu dans le dossier ${parent.reference} (${PROCEDURES[code].libelle})`
      : dos.avisPrealable
        ? "Avis écrit d'un avocat sur votre situation"
        : PROCEDURES[code].libelle,
    recoursPrealable: estRecoursPrealable(code) && !dos.avisPrealable && !parent,
    appelDe: parent?.reference,
    consultation: dos.procedure === "CONSULTATION",
    lignes,
    troisFois: total >= SEUIL_TROIS_FOIS,
    dateLimite: frDate(dos.dateLimite),
  };
}

export async function accepterConvention(
  d: Base,
  dos: typeof dossiers.$inferSelect,
  cli: typeof clients.$inferSelect,
  ip: string,
) {
  const donnees = await donneesConvention(d, dos, cli);
  const texte = texteConvention(donnees);
  const parent = !!donnees.appelDe;
  await d.insert(conventions).values({
    dossierId: dos.id,
    type: parent ? "AVENANT_APPEL" : "CONVENTION",
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
  // Facture Pennylane (si configuré) ; en cas d'échec, la tâche planifiée reprend.
  if (await valeur("PENNYLANE_API_KEY")) await facturer(d, maj[0].id).catch(() => undefined);
  // Appel : le dossier reste à l'avocat de la première instance, qui est prévenu et l'accepte comme tout dossier.
  if (dos.dossierParentId && dos.avocatId) {
    const delais = await lireParametre(d, "delais");
    const h = ajouterHeuresOuvrees(new Date(), delais.acceptationNormaleH);
    await d.update(dossiers).set({ acceptationAvant: instantParis(h.jour, h.minutes) }).where(eq(dossiers.id, dossierId));
    const [av] = await d.select().from(utilisateurs).where(eq(utilisateurs.id, dos.avocatId));
    if (av)
      await envoyer({
        canal: "EMAIL",
        destinataire: av.email,
        sujet: `Appel accepté et réglé — dossier ${dos.reference}`,
        texte: `Le client a accepté et réglé l'appel. Dossier ${dos.reference} à accepter.\n${process.env.URL_PUBLIQUE ?? "https://lexpatria.fr"}/avocat/dossiers/${dos.reference}`,
      });
    return;
  }
  // Consultation en visio : pas d'attribution, le client choisit son créneau (et donc son avocat) dans Bookings.
  if (dos.procedure === "CONSULTATION") {
    const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
    if (cli?.email)
      await envoyer({
        canal: "EMAIL",
        destinataire: cli.email,
        sujet: "Choisissez votre rendez-vous — LEXPATRIA",
        texte: `Bonjour,\n\nVotre paiement est confirmé. Choisissez le créneau de votre consultation en visio : ${lienRendezVous(dos.id)}\n\nLEXPATRIA Avocats`,
      });
    return;
  }
  await attribuer(d, dossierId, dos.traitement === "URGENCE");
  await confirmerAuClient(d, dossierId);
}

/** E-mail de confirmation au client après paiement : avocat attribué, lien vers l'espace, pièces à transmettre. */
async function confirmerAuClient(d: Base, dossierId: string) {
  const [dos] = await d.select().from(dossiers).where(eq(dossiers.id, dossierId));
  if (!dos) return;
  const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
  if (!cli?.email) return;
  const [av] = dos.avocatId ? await d.select().from(utilisateurs).where(eq(utilisateurs.id, dos.avocatId)) : [];
  const langue = estLangue(cli.langue) ? cli.langue : "fr";
  const delai = traduire(langue, dos.traitement === "URGENCE" ? "10 heures ouvrées" : "48 heures ouvrées");
  const suite = av
    ? traduire(langue, "Votre dossier sera traité par Maître {nom}, qui prendra attache avec vous sous {delai}.", { nom: `${av.prenom} ${av.nom}`, delai })
    : traduire(langue, "Votre dossier est transmis au cabinet : un avocat prendra attache avec vous sous {delai}.", { delai });
  const origine = process.env.URL_PUBLIQUE ?? "https://lexpatria.fr";
  // Lien direct vers la suite du dépôt (pièces et questionnaire), valable 14 jours ; il ne montre aucune donnée du dossier.
  const lienSuite = `${origine}/depot/merci?ref=${encodeURIComponent(dos.reference)}&suite=${encodeURIComponent(signer(dos.id, 24 * 14))}`;
  const pieces =
    dos.avisPrealable || dos.procedure === "DIAGNOSTIC"
      ? ""
      : "\n\n" +
        traduire(langue, "Pour que votre avocat avance dès maintenant, ajoutez dans votre espace la décision contestée (toutes les pages) et l'enveloppe ou la preuve de notification, puis vos autres documents.") +
        "\n" +
        traduire(langue, "Transmettre mes documents : {lien}", { lien: lienSuite });
  await envoyer({
    canal: "EMAIL",
    destinataire: cli.email,
    sujet: traduire(langue, "Paiement confirmé — dossier {ref}", { ref: dos.reference }),
    texte:
      `${traduire(langue, "Bonjour,")}\n\n${traduire(langue, "Votre paiement est confirmé.")} ${suite}${pieces}\n\n` +
      `${traduire(langue, "Votre espace : {lien} (connexion par un code reçu à cette adresse).", { lien: `${origine}/espace` })}\n\nLEXPATRIA Avocats`,
  });
}

/** Lien de choix du créneau (consultation en visio), valable 30 jours. */
export function lienRendezVous(dossierId: string) {
  return `${process.env.URL_PUBLIQUE ?? "https://lexpatria.fr"}/consultation/rendez-vous?jeton=${encodeURIComponent(signer(dossierId, 24 * 30, "rdv"))}`;
}
