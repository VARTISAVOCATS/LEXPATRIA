// Dossiers pris sans honoraires (pro bono).
// Le client fait le parcours jusqu'à l'écran de paiement ; un associé retrouve ce pré-dossier dans l'espace cabinet,
// choisit l'avocat et propose l'intervention sans honoraires. Le client reçoit un lien pour accepter la convention
// d'intervention sans honoraires : le dossier est alors pris en charge par l'avocat choisi, sans paiement.
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { numeroDefinitif, type Base } from "@/db";
import { clients, conventions, dossiers, utilisateurs } from "@/db/schema";
import { texteConventionProBono, VERSION_PRO_BONO } from "@/lib/convention";
import { signer, verifier } from "@/lib/jeton";
import { empreinteTexte, journaliser } from "@/lib/journal";
import { procedureLibelle } from "@/lib/modeles";
import { envoyer } from "./notifications";
import { donneesConvention } from "./paiement";
import type { Membre } from "./session";

type Resultat = { ok: true } | { ok: false; erreur: string };
const USAGE = "probono";
const URL = () => process.env.URL_PUBLIQUE ?? "https://lexpatria.fr";

/** Pré-dossiers (parcours arrêté avant le paiement), du plus récent au plus ancien. */
export async function preDossiers(d: Base) {
  return d
    .select({ dos: dossiers, cli: clients })
    .from(dossiers)
    .innerJoin(clients, eq(clients.id, dossiers.clientId))
    .where(and(inArray(dossiers.statut, ["PRE_DOSSIER", "ATTENTE_PROCHE"]), isNull(dossiers.archiveLe)))
    .orderBy(desc(dossiers.creeLe))
    .limit(200);
}

/** L'associé propose l'intervention sans honoraires : le client reçoit le lien pour accepter la convention. */
export async function proposerProBono(d: Base, m: Membre, reference: string, avocatId: string): Promise<Resultat> {
  if (m.role !== "ASSOCIE") return { ok: false, erreur: "Seul un associé peut décider d'une intervention sans honoraires." };
  const [dos] = await d.select().from(dossiers).where(eq(dossiers.reference, reference));
  if (!dos || !["PRE_DOSSIER", "ATTENTE_PROCHE"].includes(dos.statut)) return { ok: false, erreur: "Ce dossier n'est plus en attente de paiement." };
  const [av] = await d.select().from(utilisateurs).where(and(eq(utilisateurs.id, avocatId), eq(utilisateurs.actif, true)));
  if (!av || (av.role !== "AVOCAT" && av.role !== "ASSOCIE")) return { ok: false, erreur: "Avocat introuvable." };
  const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
  if (!cli?.email) return { ok: false, erreur: "Le client n'a pas d'adresse e-mail." };
  await d.update(dossiers).set({ proBono: true, avocatId: av.id, majLe: new Date() }).where(eq(dossiers.id, dos.id));
  await journaliser(d, { dossierId: dos.id, acteur: m.id, action: "PRO_BONO_PROPOSE", details: { avocatId: av.id } });
  await envoyer({
    canal: "EMAIL",
    destinataire: cli.email,
    sujet: "Votre dossier — LEXPATRIA Avocats",
    texte:
      `Bonjour,\n\nLe cabinet accepte de prendre en charge votre dossier ${dos.reference} (${procedureLibelle(dos.procedure)}) sans honoraires. ` +
      `Votre dossier sera traité par Maître ${av.prenom} ${av.nom}.\n\n` +
      `Pour confirmer, lisez et acceptez la convention d'intervention : ${URL()}/pro-bono/${encodeURIComponent(signer(dos.id, 24 * 14, USAGE))}\n` +
      `Ce lien est valable 14 jours.\n\nLEXPATRIA Avocats`,
  });
  return { ok: true };
}

/** Dossier et convention à présenter au client qui a reçu le lien. */
export async function lireProBono(d: Base, jeton: string) {
  const id = verifier(jeton, USAGE);
  if (!id) return null;
  const [dos] = await d.select().from(dossiers).where(eq(dossiers.id, id));
  if (!dos || !dos.proBono) return null;
  const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
  const [av] = dos.avocatId ? await d.select().from(utilisateurs).where(eq(utilisateurs.id, dos.avocatId)) : [];
  const texte = texteConventionProBono(await donneesConvention(d, dos, cli));
  return { dos, cli, avocat: av ? `Maître ${av.prenom} ${av.nom}` : null, texte, dejaAcceptee: !["PRE_DOSSIER", "ATTENTE_PROCHE"].includes(dos.statut) };
}

/** Le client accepte la convention : le dossier est pris en charge par l'avocat choisi, sans paiement. */
export async function accepterProBono(d: Base, jeton: string, ip: string, executionImmediate: boolean): Promise<Resultat> {
  const x = await lireProBono(d, jeton);
  if (!x) return { ok: false, erreur: "Lien expiré ou invalide : contactez le cabinet." };
  if (x.dejaAcceptee) return { ok: true };
  const { dos, texte } = x;
  await d.insert(conventions).values({ dossierId: dos.id, type: "PRO_BONO", version: VERSION_PRO_BONO, texte, empreinte: empreinteTexte(texte), ip, executionImmediate });
  const maintenant = new Date();
  const [numerote] = await d
    .update(dossiers)
    .set({ statut: "PRIS_EN_CHARGE", reference: numeroDefinitif, accepteLe: maintenant, majLe: maintenant })
    .where(eq(dossiers.id, dos.id))
    .returning({ reference: dossiers.reference });
  dos.reference = numerote.reference;
  await journaliser(d, { dossierId: dos.id, acteur: "CLIENT", action: "CONVENTION_ACCEPTEE", details: { version: VERSION_PRO_BONO, ip, proBono: true } });
  const [av] = dos.avocatId ? await d.select().from(utilisateurs).where(eq(utilisateurs.id, dos.avocatId)) : [];
  if (av)
    await envoyer({
      canal: "EMAIL",
      destinataire: av.email,
      sujet: `Dossier sans honoraires accepté par le client — ${dos.reference}`,
      texte: `Le client a accepté la convention d'intervention sans honoraires. Le dossier ${dos.reference} vous est attribué et pris en charge.\n${URL()}/avocat/dossiers/${dos.reference}`,
    });
  if (x.cli.email)
    await envoyer({
      canal: "EMAIL",
      destinataire: x.cli.email,
      sujet: "Votre dossier est pris en charge — LEXPATRIA",
      texte: `Bonjour,\n\nVotre dossier ${dos.reference} est pris en charge${x.avocat ? ` par ${x.avocat}` : ""}. Vous pouvez suivre votre dossier, transmettre vos documents et écrire à votre avocat depuis votre espace : ${URL()}/espace\n\nLEXPATRIA Avocats`,
    });
  return { ok: true };
}
