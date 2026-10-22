// Attribution automatique d'un dossier payé (cahier des charges, section 8).
// Avocat actif, attribution ouverte, non indisponible, le moins chargé ; à défaut, un associé.
// Lot 3 : alertes SMS/WhatsApp et e-mail, délai d'acceptation de 2 heures ouvrées (1 heure en urgence),
// réattribution automatique si l'avocat n'accepte pas.

import { and, eq, gte, inArray, lte, notInArray, sql } from "drizzle-orm";
import type { Base } from "@/db";
import { dossiers, indisponibilites, utilisateurs } from "@/db/schema";
import { ajouterHeuresOuvrees, instantParis } from "@/lib/calendrier";
import { journaliser } from "@/lib/journal";
import { lireParametre } from "./parametres";

export async function attribuer(d: Base, dossierId: string, urgent: boolean) {
  const maintenant = new Date();
  const absents = d
    .select({ id: indisponibilites.avocatId })
    .from(indisponibilites)
    .where(and(lte(indisponibilites.debut, maintenant), gte(indisponibilites.fin, maintenant)));

  const candidats = await d
    .select({
      id: utilisateurs.id,
      prenom: utilisateurs.prenom,
      nom: utilisateurs.nom,
      role: utilisateurs.role,
      charge: sql<number>`(select count(*) from ${dossiers} where ${dossiers.avocatId} = ${utilisateurs.id} and ${dossiers.statut} in ('PAYE','PRIS_EN_CHARGE','EN_REDACTION'))`,
    })
    .from(utilisateurs)
    .where(
      and(
        eq(utilisateurs.actif, true),
        eq(utilisateurs.attributionOuverte, true),
        inArray(utilisateurs.role, ["AVOCAT", "ASSOCIE"]),
        notInArray(utilisateurs.id, absents),
      ),
    );

  if (!candidats.length) return null;
  // Les collaborateurs d'abord ; l'associé reçoit le dossier quand personne d'autre n'est disponible.
  candidats.sort((a, b) => (a.role === b.role ? Number(a.charge) - Number(b.charge) : a.role === "AVOCAT" ? -1 : 1));
  const choisi = candidats[0];

  const delais = await lireParametre(d, "delais");
  const limite = ajouterHeuresOuvrees(maintenant, urgent ? delais.acceptationUrgenceH : delais.acceptationNormaleH);
  const acceptationAvant = instantParis(limite.jour, limite.minutes);
  await d.update(dossiers).set({ avocatId: choisi.id, acceptationAvant, majLe: maintenant }).where(eq(dossiers.id, dossierId));
  await journaliser(d, { dossierId, acteur: "SYSTEME", action: "DOSSIER_ATTRIBUE", details: { avocatId: choisi.id, urgent } });
  return choisi;
}
