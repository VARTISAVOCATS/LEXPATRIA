// Accès aux dossiers depuis les espaces client et cabinet, avec contrôle des droits.
// Client : uniquement ses dossiers payés (même adresse e-mail).
// Cabinet : associés et secrétariat voient tout ; un avocat voit les dossiers qui lui sont attribués.

import { and, asc, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import type { Base } from "@/db";
import {
  actes,
  attestations,
  clients,
  conventions,
  dossiers,
  echeances,
  messages,
  paiements,
  pieces,
  utilisateurs,
} from "@/db/schema";
import { journaliser } from "@/lib/journal";
import { envoyer } from "./notifications";
import type { Membre } from "./session";
import { enregistrer, type FichierStocke } from "./stockage";

const EXCLUS_CLIENT = ["PRE_DOSSIER"] as const;

export type Dossier = typeof dossiers.$inferSelect;

export async function dossiersDuClient(d: Base, email: string) {
  return d
    .select({ dos: dossiers, avocatPrenom: utilisateurs.prenom, avocatNom: utilisateurs.nom })
    .from(dossiers)
    .innerJoin(clients, eq(clients.id, dossiers.clientId))
    .leftJoin(utilisateurs, eq(utilisateurs.id, dossiers.avocatId))
    .where(and(sql`lower(${clients.email}) = ${email}`, notInArray(dossiers.statut, [...EXCLUS_CLIENT])))
    .orderBy(desc(dossiers.creeLe));
}

export async function accesClient(d: Base, email: string, reference: string): Promise<Dossier | null> {
  const [r] = await d
    .select({ dos: dossiers })
    .from(dossiers)
    .innerJoin(clients, eq(clients.id, dossiers.clientId))
    .where(and(eq(dossiers.reference, reference), sql`lower(${clients.email}) = ${email}`, notInArray(dossiers.statut, [...EXCLUS_CLIENT])));
  return r?.dos ?? null;
}

export function voitTout(m: Membre) {
  return m.role === "ASSOCIE" || m.role === "SECRETARIAT";
}

export async function accesEquipe(d: Base, m: Membre, reference: string): Promise<Dossier | null> {
  const [dos] = await d.select().from(dossiers).where(eq(dossiers.reference, reference));
  if (!dos || dos.statut === "PRE_DOSSIER") return null;
  if (voitTout(m) || dos.avocatId === m.id) return dos;
  return null;
}

export type Filtre = "a_prendre" | "en_cours" | "termines" | "tous";

export async function dossiersEquipe(d: Base, m: Membre, filtre: Filtre, recherche?: string) {
  const conds = [ne(dossiers.statut, "PRE_DOSSIER")];
  if (!voitTout(m)) conds.push(eq(dossiers.avocatId, m.id));
  if (filtre === "a_prendre") conds.push(eq(dossiers.statut, "PAYE"));
  if (filtre === "en_cours") conds.push(notInArray(dossiers.statut, ["PAYE", "CLOS", "CLOS_REMBOURSE", "ATTENTE_PROCHE", "APPEL_PROPOSE"]));
  if (filtre === "termines") conds.push(inArray(dossiers.statut, ["CLOS", "CLOS_REMBOURSE"]));
  if (recherche?.trim()) {
    const q = `%${recherche.trim().toLowerCase()}%`;
    conds.push(
      sql`(lower(${dossiers.reference}) like ${q} or lower(coalesce(${clients.nom},'')) like ${q} or lower(coalesce(${clients.prenom},'')) like ${q} or lower(coalesce(${clients.email},'')) like ${q})`,
    );
  }
  return d
    .select({
      dos: dossiers,
      cli: { prenom: clients.prenom, nom: clients.nom, algerien: clients.algerien },
      avocat: { prenom: utilisateurs.prenom, nom: utilisateurs.nom },
    })
    .from(dossiers)
    .innerJoin(clients, eq(clients.id, dossiers.clientId))
    .leftJoin(utilisateurs, eq(utilisateurs.id, dossiers.avocatId))
    .where(and(...conds))
    .orderBy(sql`${dossiers.dateLimite} asc nulls last`, desc(dossiers.creeLe))
    .limit(200);
}

export async function compteurs(d: Base, m: Membre) {
  const base = voitTout(m) ? sql`true` : sql`${dossiers.avocatId} = ${m.id}`;
  const [r] = await d
    .select({
      aPrendre: sql<number>`count(*) filter (where ${dossiers.statut} = 'PAYE')`,
      enCours: sql<number>`count(*) filter (where ${dossiers.statut} not in ('PRE_DOSSIER','PAYE','CLOS','CLOS_REMBOURSE','ATTENTE_PROCHE','APPEL_PROPOSE'))`,
      termines: sql<number>`count(*) filter (where ${dossiers.statut} in ('CLOS','CLOS_REMBOURSE'))`,
      tous: sql<number>`count(*) filter (where ${dossiers.statut} <> 'PRE_DOSSIER')`,
    })
    .from(dossiers)
    .where(base);
  return { aPrendre: Number(r.aPrendre), enCours: Number(r.enCours), termines: Number(r.termines), tous: Number(r.tous) };
}

export async function detailDossier(d: Base, dos: Dossier) {
  const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
  const avocat = dos.avocatId ? (await d.select().from(utilisateurs).where(eq(utilisateurs.id, dos.avocatId)))[0] ?? null : null;
  const [lesPieces, lesMessages, lesPaiements, lesConventions, lesEcheances, lesActes] = await Promise.all([
    d.select().from(pieces).where(eq(pieces.dossierId, dos.id)).orderBy(asc(pieces.creeLe)),
    d.select().from(messages).where(eq(messages.dossierId, dos.id)).orderBy(asc(messages.creeLe)),
    d.select().from(paiements).where(eq(paiements.dossierId, dos.id)).orderBy(asc(paiements.creeLe)),
    d.select().from(conventions).where(eq(conventions.dossierId, dos.id)).orderBy(asc(conventions.accepteeLe)),
    d.select().from(echeances).where(eq(echeances.dossierId, dos.id)).orderBy(asc(echeances.date)),
    d.select().from(actes).where(eq(actes.dossierId, dos.id)).orderBy(desc(actes.version)),
  ]);
  const lesAttestations = lesActes.length
    ? await d.select().from(attestations).where(inArray(attestations.acteId, lesActes.map((a) => a.id))).orderBy(desc(attestations.le))
    : [];
  return {
    dos,
    cli,
    avocat,
    pieces: lesPieces,
    messages: lesMessages,
    paiements: lesPaiements,
    conventions: lesConventions,
    echeances: lesEcheances,
    actes: lesActes,
    attestations: lesAttestations,
  };
}

export type Detail = Awaited<ReturnType<typeof detailDossier>>;

const ORIGINE = () => process.env.URL_PUBLIQUE ?? "https://lexpatria.fr";

/** Message dans le dossier. Notification par e-mail sans aucun contenu (secret professionnel). */
export async function ajouterMessage(
  d: Base,
  dos: Dossier,
  auteur: "CLIENT" | "AVOCAT" | "SECRETARIAT",
  auteurId: string | null,
  contenu: string,
) {
  const texte = contenu.trim().slice(0, 5000);
  if (!texte) return null;
  const [msg] = await d
    .insert(messages)
    .values({ dossierId: dos.id, auteur, auteurId, contenu: texte, afficheLe: new Date() })
    .returning();
  await journaliser(d, { dossierId: dos.id, acteur: auteurId ?? "CLIENT", action: "MESSAGE", details: { auteur } });
  if (auteur === "CLIENT") {
    if (dos.avocatId) {
      const [av] = await d.select().from(utilisateurs).where(eq(utilisateurs.id, dos.avocatId));
      if (av)
        await envoyer({
          canal: "EMAIL",
          destinataire: av.email,
          sujet: `Nouveau message — dossier ${dos.reference}`,
          texte: `Un nouveau message vous attend dans le dossier ${dos.reference}.\n${ORIGINE()}/avocat/dossiers/${dos.reference}`,
        });
    }
  } else {
    const [cli] = await d.select().from(clients).where(eq(clients.id, dos.clientId));
    if (cli?.email)
      await envoyer({
        canal: "EMAIL",
        destinataire: cli.email,
        sujet: "Nouveau message de votre avocat — LEXPATRIA",
        texte: `Bonjour,\n\nVotre avocat vous a écrit. Pour lire son message, connectez-vous à votre espace : ${ORIGINE()}/espace\n\nLEXPATRIA Avocats`,
      });
  }
  return msg;
}

/** Pièce ajoutée depuis un espace (client ou cabinet). */
export async function ajouterPiece(
  d: Base,
  dos: Dossier,
  libelle: string,
  fichiers: { nom: string; mime: string; donnees: Buffer }[],
  par: string,
) {
  const stockes: FichierStocke[] = [];
  for (const f of fichiers) stockes.push(await enregistrer(dos.reference, f.nom, f.mime, f.donnees));
  const [{ n }] = await d.select({ n: sql<number>`coalesce(max(${pieces.numero}), 0)` }).from(pieces).where(eq(pieces.dossierId, dos.id));
  const [p] = await d
    .insert(pieces)
    .values({ dossierId: dos.id, type: "AUTRE", libelle: libelle.trim().slice(0, 200) || "Pièce", numero: Number(n) + 1, fichiers: stockes })
    .returning();
  await journaliser(d, { dossierId: dos.id, acteur: par, action: "PIECE_AJOUTEE", details: { pieceId: p.id, fichiers: stockes.length } });
  return p;
}

/** Marque comme lus les messages reçus par le lecteur (client : messages du cabinet ; cabinet : messages du client). */
export async function marquerLus(d: Base, dossierId: string, lecteur: "CLIENT" | "EQUIPE") {
  await d
    .update(messages)
    .set({ luLe: new Date() })
    .where(
      and(
        eq(messages.dossierId, dossierId),
        sql`${messages.luLe} is null`,
        lecteur === "CLIENT" ? ne(messages.auteur, "CLIENT") : eq(messages.auteur, "CLIENT"),
      ),
    );
}
