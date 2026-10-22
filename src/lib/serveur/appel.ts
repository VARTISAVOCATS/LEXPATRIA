// Lot 3, étape 3 : espace appel. L'avocat propose l'appel d'un jugement ; un dossier d'appel est créé,
// relié au dossier de première instance. Le client lit l'avis de son avocat, accepte l'avenant d'appel et règle
// dans son espace ; le dossier revient alors à l'avocat de la première instance. Le délai d'appel est estimé,
// puis vérifié par l'avocat comme pour tout recours (aucun dépôt avant vérification).

import { and, eq, ne } from "drizzle-orm";
import { prochaineReference, type Base } from "@/db";
import { dossiers } from "@/db/schema";
import { ajouterMois, ecartJours, versJour } from "@/lib/calendrier";
import { journaliser } from "@/lib/journal";
import { courAppel, tribunalCompetent } from "@/lib/modeles";
import { peutFaireAppel } from "@/lib/statuts";
import { ajouterMessage, type Dossier } from "./dossiers";
import type { Membre } from "./session";

export type Resultat = { ok: true; reference?: string } | { ok: false; erreur: string };
const refus = (erreur: string): Resultat => ({ ok: false, erreur });
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Délai d'appel estimé à compter de la notification du jugement : un mois en matière d'OQTF,
 * deux mois sinon (article R. 811-2 du code de justice administrative). Toujours vérifié par l'avocat.
 */
export function delaiAppelEstime(procedure: string, notification: string): string {
  const j = versJour(new Date(`${notification}T12:00:00Z`));
  return ajouterMois(j, procedure === "OQTF" ? 1 : 2).toISOString().slice(0, 10);
}

export async function appelDe(d: Base, parentId: string) {
  const [a] = await d
    .select()
    .from(dossiers)
    .where(and(eq(dossiers.dossierParentId, parentId), ne(dossiers.statut, "CLOS_REMBOURSE")))
    .limit(1);
  return a ?? null;
}

export async function premiereInstance(d: Base, dos: Dossier) {
  if (!dos.dossierParentId) return null;
  const [p] = await d.select().from(dossiers).where(eq(dossiers.id, dos.dossierParentId));
  return p ?? null;
}

export async function proposerAppel(
  d: Base,
  m: Membre,
  parent: Dossier,
  x: { dateJugement: string; dateNotification: string; message: string },
): Promise<Resultat> {
  if (m.role !== "ASSOCIE" && !(m.role === "AVOCAT" && parent.avocatId === m.id)) return refus("Seul l'avocat en charge du dossier propose l'appel.");
  if (parent.dossierParentId) return refus("Ce dossier est déjà un dossier d'appel.");
  if (!peutFaireAppel(parent.procedure) || parent.avisPrealable) return refus("Cette procédure ne donne pas lieu à un appel.");
  if (parent.statut !== "JUGE" && parent.statut !== "CLOS") return refus("Indiquez d'abord que la décision du tribunal est rendue.");
  if (!DATE.test(x.dateJugement) || !DATE.test(x.dateNotification) || x.dateNotification < x.dateJugement) return refus("Dates du jugement invalides.");
  const message = x.message.trim();
  if (message.length < 20) return refus("Expliquez au client, en quelques lignes, pourquoi vous lui proposez l'appel.");
  if (/XXX/.test(message)) return refus("Complétez les mentions XXX du message.");
  if (await appelDe(d, parent.id)) return refus("Un appel est déjà proposé pour ce dossier.");

  const limite = delaiAppelEstime(parent.procedure, x.dateNotification);
  if (ecartJours(versJour(new Date()), versJour(new Date(`${limite}T12:00:00Z`))) < 0) return refus("Le délai d'appel estimé est déjà expiré.");
  const tribunal = parent.tribunal ?? tribunalCompetent(parent.prefecture);
  const [a] = await d
    .insert(dossiers)
    .values({
      reference: await prochaineReference(d),
      clientId: parent.clientId,
      procedure: parent.procedure,
      statut: "APPEL_PROPOSE",
      avocatId: parent.avocatId ?? m.id,
      dossierParentId: parent.id,
      prefecture: parent.prefecture,
      situationOQTF: parent.situationOQTF,
      tribunal,
      cour: courAppel(tribunal),
      recit: parent.recit,
      langueRecit: parent.langueRecit,
      qualification: parent.qualification,
      faitsExtraits: parent.faitsExtraits,
      dateDecision: x.dateJugement,
      dateNotification: x.dateNotification,
      dateLimite: limite,
    })
    .returning();
  await journaliser(d, { dossierId: parent.id, acteur: m.id, action: "APPEL_PROPOSE", details: { appel: a.reference, dateJugement: x.dateJugement, dateLimite: limite } });
  await journaliser(d, { dossierId: a.id, acteur: m.id, action: "DOSSIER_APPEL_CREE", details: { premiereInstance: parent.reference } });
  await ajouterMessage(
    d,
    parent,
    "AVOCAT",
    m.id,
    `${message}\n\nSi vous souhaitez faire appel, ouvrez le dossier ${a.reference} dans votre espace : vous y trouverez l'avenant d'appel à accepter et le règlement des honoraires. Date limite d'appel estimée : ${limite.split("-").reverse().join("/")}.`,
  );
  return { ok: true, reference: a.reference };
}

/** Le client renonce à l'appel proposé : le dossier d'appel est clos, sans frais. */
export async function renoncerAppel(d: Base, dos: Dossier): Promise<Resultat> {
  if (dos.statut !== "APPEL_PROPOSE") return refus("Cet appel n'est plus en attente de votre décision.");
  await d.update(dossiers).set({ statut: "CLOS", majLe: new Date() }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: "CLIENT", action: "APPEL_DECLINE" });
  await ajouterMessage(d, dos, "CLIENT", null, "Je ne souhaite pas faire appel.");
  return { ok: true };
}
