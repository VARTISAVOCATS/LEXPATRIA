// Paiement en trois fois géré par le cabinet : prélèvement des échéances 2 et 3 sur la carte enregistrée,
// nouvelles tentatives après un rejet, lien de régularisation envoyé au client, pénalité forfaitaire passé le délai.
// Appelé par la tâche planifiée (toutes les 15 minutes) ; le webhook Stripe confirme les règlements.

import { and, asc, eq, inArray, lte, or } from "drizzle-orm";
import type { Base } from "@/db";
import { clients, dossiers, echeancier, paiements, utilisateurs } from "@/db/schema";
import { estLangue, traduire } from "@/i18n";
import { dateCourte } from "@/lib/echeancier";
import { signer } from "@/lib/jeton";
import { journaliser } from "@/lib/journal";
import { formatEuros } from "@/lib/procedures";
import { stripe } from "@/lib/stripe";
import { valeur } from "./connexions";
import { facturer } from "./integrations/pennylane";
import { envoyer } from "./notifications";
import { lireParametre } from "./parametres";

const JOUR = 86_400_000;
/** Délai entre deux tentatives automatiques après un rejet. */
const ENTRE_TENTATIVES = 3 * JOUR;
const origine = () => process.env.URL_PUBLIQUE ?? "https://lexpatria.fr";
const jourParis = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);

export type LigneEcheance = typeof echeancier.$inferSelect;
export const aRegler = (e: LigneEcheance) => e.montant + e.penalite;

/** Lien de règlement d'une échéance rejetée, valable 30 jours ; il ne montre aucune donnée du dossier. */
export const lienEcheance = (id: string) => `${origine()}/echeance/${encodeURIComponent(signer(id, 24 * 30, "echeance"))}`;

export const echeancesDossier = (d: Base, dossierId: string) =>
  d.select().from(echeancier).where(eq(echeancier.dossierId, dossierId)).orderBy(asc(echeancier.rang));

async function libelleDossier(d: Base, dossierId: string) {
  const [p] = await d.select({ lignes: paiements.lignes }).from(paiements).where(eq(paiements.dossierId, dossierId)).orderBy(asc(paiements.creeLe)).limit(1);
  const l = (p?.lignes as { libelle: string }[] | undefined)?.[0]?.libelle ?? "Honoraires";
  return l.replace(/ — échéance 1\/3$/, "");
}

/** Échéance réglée (prélèvement automatique, régularisation par le client ou simulation). Idempotent. */
export async function echeancePayee(d: Base, id: string, ref: { intentId?: string; moyenId?: string | null } = {}) {
  const [e] = await d
    .update(echeancier)
    .set({ statut: "PAYE", payeLe: new Date(), prochaineTentative: null, ...(ref.intentId ? { intentId: ref.intentId } : {}), ...(ref.moyenId ? { stripeMoyenId: ref.moyenId } : {}) })
    .where(and(eq(echeancier.id, id), inArray(echeancier.statut, ["A_VENIR", "ECHEC"])))
    .returning();
  if (!e) return false;
  // Une carte remplacée lors d'une régularisation sert aussi à l'échéance suivante.
  if (ref.moyenId) await d.update(echeancier).set({ stripeMoyenId: ref.moyenId }).where(and(eq(echeancier.dossierId, e.dossierId), eq(echeancier.statut, "A_VENIR")));
  const libelle = await libelleDossier(d, e.dossierId);
  const lignes = [{ diligence: "ECHEANCE", libelle: `${libelle} — échéance ${e.rang}/3`, montant: e.montant }];
  if (e.penalite) lignes.push({ diligence: "PENALITE", libelle: "Pénalité forfaitaire pour échéance rejetée", montant: e.penalite });
  const [p] = await d
    .insert(paiements)
    .values({ dossierId: e.dossierId, stripeIntentId: ref.intentId ?? e.intentId, moyen: "card", montant: aRegler(e), lignes, statut: "PAYE" })
    .returning();
  await journaliser(d, { dossierId: e.dossierId, acteur: "SYSTEME", action: "ECHEANCE_REGLEE", details: { rang: e.rang, montant: aRegler(e) } });
  if (await valeur("PENNYLANE_API_KEY")) await facturer(d, p.id).catch(() => undefined);
  return true;
}

async function prevenirClient(d: Base, e: LigneEcheance, objet: "REJET" | "PENALITE") {
  const [dos] = await d.select().from(dossiers).where(eq(dossiers.id, e.dossierId));
  const [cli] = dos ? await d.select().from(clients).where(eq(clients.id, dos.clientId)) : [];
  if (!cli?.email) return;
  const l = estLangue(cli.langue) ? cli.langue : "fr";
  const regles = await lireParametre(d, "echeancier");
  const texte =
    objet === "REJET"
      ? traduire(
          l,
          "Bonjour,\n\nL'échéance {rang}/3 de {montant} prévue le {date} n'a pas pu être prélevée sur votre carte. Une nouvelle tentative aura lieu dans quelques jours. Vous pouvez aussi la régler dès maintenant : {lien}\n\nSans règlement dans un délai de {jours} jours, une pénalité forfaitaire de {penalite} s'ajoute, comme le prévoit votre convention d'honoraires.\n\nLEXPATRIA Avocats",
          { rang: e.rang, montant: formatEuros(e.montant), date: dateCourte(e.le), lien: lienEcheance(e.id), jours: regles.regularisationJours, penalite: formatEuros(regles.penalite) },
        )
      : traduire(
          l,
          "Bonjour,\n\nL'échéance {rang}/3 n'a pas été régularisée. Conformément à votre convention d'honoraires, une pénalité forfaitaire de {penalite} s'ajoute : le montant à régler est de {montant}. Pour le régler : {lien}\n\nLEXPATRIA Avocats",
          { rang: e.rang, penalite: formatEuros(e.penalite), montant: formatEuros(aRegler(e)), lien: lienEcheance(e.id) },
        );
  await envoyer({ canal: "EMAIL", destinataire: cli.email, sujet: traduire(l, "Votre échéance — dossier {ref}", { ref: dos.reference }), texte });
}

async function prevenirAssocies(d: Base, e: LigneEcheance) {
  const [dos] = await d.select({ reference: dossiers.reference }).from(dossiers).where(eq(dossiers.id, e.dossierId));
  const associes = await d.select({ email: utilisateurs.email }).from(utilisateurs).where(and(eq(utilisateurs.role, "ASSOCIE"), eq(utilisateurs.actif, true)));
  for (const a of associes)
    await envoyer({
      canal: "EMAIL",
      destinataire: a.email,
      sujet: `Échéance impayée — dossier ${dos?.reference ?? ""}`,
      texte: `L'échéance ${e.rang}/3 du dossier ${dos?.reference ?? ""} (${formatEuros(aRegler(e))}) reste impayée après les tentatives automatiques. Le client a reçu le lien de régularisation.\n${origine()}/avocat/dossiers/${dos?.reference ?? ""}`,
    });
}

/** Tâche planifiée : échéances arrivées à terme, nouvelles tentatives, pénalités. */
export async function preleverEcheances(d: Base, maintenant = new Date()) {
  const regles = await lireParametre(d, "echeancier");
  const aujourdhui = jourParis(maintenant);
  const s = await stripe();
  const dues = await d
    .select({ e: echeancier, statutDossier: dossiers.statut })
    .from(echeancier)
    .innerJoin(dossiers, eq(dossiers.id, echeancier.dossierId))
    .where(
      or(
        and(eq(echeancier.statut, "A_VENIR"), lte(echeancier.le, aujourdhui)),
        and(eq(echeancier.statut, "ECHEC"), lte(echeancier.prochaineTentative, maintenant)),
      ),
    );
  let preleves = 0;
  let rejets = 0;
  for (const { e, statutDossier } of dues) {
    if (statutDossier === "PRE_DOSSIER") continue; // première échéance jamais réglée
    if (e.statut === "ECHEC" && e.tentatives >= regles.tentativesMax) continue;
    if (!s) {
      // Développement sans Stripe : prélèvement simulé.
      if (await echeancePayee(d, e.id)) preleves++;
      continue;
    }
    try {
      const pi = await s.paymentIntents.create(
        {
          amount: aRegler(e),
          currency: "eur",
          customer: e.stripeClientId ?? undefined,
          payment_method: e.stripeMoyenId ?? undefined,
          off_session: true,
          confirm: true,
          payment_method_types: ["card"],
          description: `LEXPATRIA — échéance ${e.rang}/3`,
          metadata: { dossierId: e.dossierId, echeanceId: e.id },
        },
        { idempotencyKey: `echeance-${e.id}-${e.tentatives}` },
      );
      if (pi.status === "succeeded") {
        if (await echeancePayee(d, e.id, { intentId: pi.id })) preleves++;
        continue;
      }
      throw new Error(pi.status);
    } catch (x) {
      rejets++;
      const tentatives = e.tentatives + 1;
      await d
        .update(echeancier)
        .set({
          statut: "ECHEC",
          tentatives,
          rejeteLe: e.rejeteLe ?? maintenant,
          prochaineTentative: tentatives < regles.tentativesMax ? new Date(maintenant.getTime() + ENTRE_TENTATIVES) : null,
        })
        .where(eq(echeancier.id, e.id));
      await journaliser(d, { dossierId: e.dossierId, acteur: "SYSTEME", action: "ECHEANCE_REJETEE", details: { rang: e.rang, tentative: tentatives, motif: x instanceof Error ? x.message.slice(0, 120) : "rejet" } });
      if (tentatives === 1) await prevenirClient(d, e, "REJET");
      if (tentatives === regles.tentativesMax) await prevenirAssocies(d, e);
    }
  }

  // Pénalité forfaitaire : échéance rejetée et non régularisée dans le délai (une seule fois par échéance).
  const limite = new Date(maintenant.getTime() - regles.regularisationJours * JOUR);
  const enRetard = await d.select().from(echeancier).where(and(eq(echeancier.statut, "ECHEC"), eq(echeancier.penalite, 0), lte(echeancier.rejeteLe, limite)));
  for (const e of enRetard) {
    if (!regles.penalite) break;
    const [maj] = await d.update(echeancier).set({ penalite: regles.penalite }).where(and(eq(echeancier.id, e.id), eq(echeancier.penalite, 0))).returning();
    if (!maj) continue;
    await journaliser(d, { dossierId: e.dossierId, acteur: "SYSTEME", action: "PENALITE_ECHEANCE", details: { rang: e.rang, penalite: regles.penalite } });
    await prevenirClient(d, maj, "PENALITE");
  }
  return { echeancesPrelevees: preleves, echeancesRejetees: rejets, penalites: enRetard.length };
}

/** Règlement d'une échéance rejetée par le client lui-même (lien reçu par e-mail). */
export async function ouvrirRegularisation(d: Base, id: string) {
  const [e] = await d.select().from(echeancier).where(eq(echeancier.id, id));
  if (!e || e.statut !== "ECHEC") return { erreur: "Cette échéance n'est plus à régler." } as const;
  const s = await stripe();
  if (!s) {
    await echeancePayee(d, e.id);
    return { simulation: true } as const;
  }
  const pi = await s.paymentIntents.create({
    amount: aRegler(e),
    currency: "eur",
    customer: e.stripeClientId ?? undefined,
    setup_future_usage: "off_session",
    payment_method_types: ["card"],
    description: `LEXPATRIA — échéance ${e.rang}/3`,
    metadata: { dossierId: e.dossierId, echeanceId: e.id },
  });
  return { clientSecret: pi.client_secret!, montant: aRegler(e) } as const;
}
