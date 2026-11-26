// Durée de conservation (politique de confidentialité) : les dossiers clos sont purgés 5 ans après la clôture.
// Sont supprimés : pièces et fichiers, actes et attestations, messages, échéances, conventions, journal et contenu du dossier
// (récit, analyses, attestations du client). Sont conservés : la référence, la procédure, les paiements et l'échéancier,
// et l'identité de facturation du client (civilité, nom, adresse), nécessaires aux factures conservées 10 ans.
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { Base } from "@/db";
import { clients, dossiers, pieces } from "@/db/schema";
import { journaliser } from "@/lib/journal";
import { supprimer, type FichierStocke } from "./stockage";

const ANS = 5;

export async function purgerDossiersClos(d: Base, maintenant = new Date()): Promise<number> {
  // Date de clôture : dernière modification du dossier clos (jamais antérieure à la clôture, donc prudente).
  const limite = new Date(maintenant);
  limite.setFullYear(limite.getFullYear() - ANS);
  const anciens = await d
    .select({ id: dossiers.id, clientId: dossiers.clientId })
    .from(dossiers)
    .where(and(inArray(dossiers.statut, ["CLOS", "CLOS_REMBOURSE"]), isNull(dossiers.donneesPurgeesLe), lt(dossiers.majLe, limite)));
  for (const a of anciens) {
    const ps = await d.select({ fichiers: pieces.fichiers }).from(pieces).where(eq(pieces.dossierId, a.id));
    for (const p of ps) for (const f of (p.fichiers as FichierStocke[]) ?? []) await supprimer(f.cle).catch(() => undefined);
    await d.execute(sql`delete from attestations where acte_id in (select id from actes where dossier_id = ${a.id})`);
    await d.execute(sql`delete from envois where dossier_id = ${a.id}`);
    for (const table of ["pieces", "actes", "messages", "echeances", "conventions_acceptees", "archives", "journal"])
      await d.execute(sql`delete from ${sql.identifier(table)} where dossier_id = ${a.id}`);
    await d
      .update(dossiers)
      .set({ recit: null, triage: null, qualification: null, analyse: null, faitsExtraits: null, priseEnCharge: null, donneesPurgeesLe: maintenant })
      .where(eq(dossiers.id, a.id));
    // Coordonnées de contact effacées si le client n'a plus de dossier actif ; l'identité de facturation est conservée.
    const [actif] = await d.execute(
      sql`select 1 from dossiers where client_id = ${a.clientId} and donnees_purgees_le is null and statut not in ('CLOS','CLOS_REMBOURSE') limit 1`,
    ).then((r) => r.rows);
    if (!actif) await d.update(clients).set({ email: null, telephone: null, dateNaissance: null, nationalite: null, consentRelances: false }).where(eq(clients.id, a.clientId));
    await journaliser(d, { dossierId: a.id, acteur: "SYSTEME", action: "DONNEES_PURGEES", details: { ans: ANS } });
  }
  return anciens.length;
}
