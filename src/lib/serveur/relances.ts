// Relance des pré-dossiers abandonnés (cahier des charges, 12 « Suivi des abandons ») :
// par e-mail uniquement (jamais par SMS), sans case à cocher ; à 2 heures puis à 24 heures ;
// lien vers le point d'arrêt ; lien de désinscription obligatoire (il coupe les relances). Textes à valider par l'avocat.
// Purge des pré-dossiers non payés après 30 jours.

import { and, eq, lt, sql } from "drizzle-orm";
import type { Base } from "@/db";
import { clients, dossiers, pieces } from "@/db/schema";
import { signer } from "@/lib/jeton";
import { journaliser } from "@/lib/journal";
import { traduire, estLangue } from "@/i18n";
import { envoyer } from "./notifications";
import { supprimer, type FichierStocke } from "./stockage";

const H = 3_600_000;

export const TEXTE_RELANCE =
  "Bonjour, votre dépôt de dossier sur LEXPATRIA Avocats n'est pas terminé. Vous pouvez le reprendre là où vous l'avez laissé : {lien}{echeance} Pour ne plus recevoir ces messages : {desinscription}";

export async function relancer(d: Base, maintenant = new Date(), origine = process.env.URL_PUBLIQUE ?? "https://lexpatria.fr") {
  const candidats = await d
    .select({ dos: dossiers, cli: clients })
    .from(dossiers)
    .innerJoin(clients, eq(clients.id, dossiers.clientId))
    .where(and(eq(dossiers.statut, "PRE_DOSSIER"), eq(clients.consentRelances, true), lt(dossiers.relancesEnvoyees, 2)));

  let envoyees = 0;
  for (const { dos, cli } of candidats) {
    const age = maintenant.getTime() - dos.creeLe.getTime();
    const due = (dos.relancesEnvoyees === 0 && age >= 2 * H) || (dos.relancesEnvoyees === 1 && age >= 24 * H);
    if (!due) continue;
    const langue = estLangue(cli.langue) ? cli.langue : "fr";
    const jeton = signer(dos.id, 72);
    const texte = traduire(langue, TEXTE_RELANCE, {
      lien: `${origine}/depot?reprise=${encodeURIComponent(jeton)}`,
      echeance: dos.dateLimite ? " " + traduire(langue, "Date limite estimée : {date}.", { date: dos.dateLimite.split("-").reverse().join("/") }) : "",
      desinscription: `${origine}/desinscription?jeton=${encodeURIComponent(jeton)}`,
    });
    const canal = "EMAIL" as const;
    const destinataire = cli.email;
    if (!destinataire) continue;
    const r = await envoyer({ canal, destinataire, sujet: traduire(langue, "Votre dépôt de dossier n'est pas terminé"), texte });
    await d
      .update(dossiers)
      .set({ relancesEnvoyees: dos.relancesEnvoyees + 1, derniereRelanceLe: maintenant })
      .where(eq(dossiers.id, dos.id));
    await journaliser(d, { dossierId: dos.id, acteur: "SYSTEME", action: "RELANCE_PRE_DOSSIER", details: { canal, rang: dos.relancesEnvoyees + 1, simule: r.simule } });
    envoyees++;
  }

  // Purge : pré-dossiers non payés de plus de 30 jours (durée mentionnée dans la politique de données),
  // avec leurs pièces, leurs fichiers et leur journal. Les clients sans autre dossier sont supprimés.
  const limite = new Date(maintenant.getTime() - 30 * 24 * H);
  const anciens = await d
    .select({ id: dossiers.id, clientId: dossiers.clientId })
    .from(dossiers)
    .where(and(eq(dossiers.statut, "PRE_DOSSIER"), lt(dossiers.creeLe, limite)));
  for (const a of anciens) {
    const ps = await d.select({ fichiers: pieces.fichiers }).from(pieces).where(eq(pieces.dossierId, a.id));
    for (const p of ps) for (const f of (p.fichiers as FichierStocke[]) ?? []) await supprimer(f.cle).catch(() => undefined);
    for (const table of ["pieces", "conventions_acceptees", "paiements", "messages", "echeances", "journal"])
      await d.execute(sql`delete from ${sql.identifier(table)} where dossier_id = ${a.id}`);
    await d.delete(dossiers).where(eq(dossiers.id, a.id));
    await d.execute(sql`delete from clients where id = ${a.clientId} and not exists (select 1 from dossiers where client_id = ${a.clientId})`);
  }
  return { envoyees, purges: anciens.length };
}
