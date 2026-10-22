// Calcul des délais de recours et du mode de traitement (cahier des charges, sections 4.2 à 4.4 et 10).
// Règle de prudence : la date limite affichée est toujours estimée AU PLUS TÔT
// (pas de délai franc, pas de report au jour ouvré suivant). L'avocat vérifie et fixe la date exacte.

import { ajouterJours, ajouterMois, ecartJours, joursOuvresEntre } from "./calendrier";
import type { CodeProcedure } from "./procedures";

/** INCONNUE : la personne ne sait pas ; on retient par prudence le délai le plus court hors rétention (7 jours). */
export type SituationOQTF = "LIBRE" | "ASSIGNE" | "DETENTION" | "RETENTION" | "LIBRE_APRES_ASILE" | "INCONNUE";

export interface ParametresDelais {
  oqtfLibreMois: number; // 1
  oqtfAssigneJours: number; // 7
  oqtfDetentionJours: number; // 7
  oqtfRetentionHeures: number; // 48
  oqtfApresAsileJours: number; // 7, délai de prudence
  refusTitreMois: number; // 2
  visaRecoursJours: number; // 30
  naturalisationMois: number; // 2
  silenceDemandeMois: number; // 4 : naissance du refus implicite sur une demande de titre
  silenceRecoursMois: number; // 2 : naissance du refus implicite après recours préalable
  recoursImpliciteMois: number; // 2
  seuilUrgenceJoursOuvres: number; // 3
  avisPossibleJoursCalendaires: number; // 10
  detentionEnLigne: boolean; // false
  retentionEnLigne: boolean; // false
}

export const DELAIS_DEFAUT: ParametresDelais = {
  oqtfLibreMois: 1,
  oqtfAssigneJours: 7,
  oqtfDetentionJours: 7,
  oqtfRetentionHeures: 48,
  oqtfApresAsileJours: 7,
  refusTitreMois: 2,
  visaRecoursJours: 30,
  naturalisationMois: 2,
  silenceDemandeMois: 4,
  silenceRecoursMois: 2,
  recoursImpliciteMois: 2,
  seuilUrgenceJoursOuvres: 3,
  avisPossibleJoursCalendaires: 10,
  detentionEnLigne: false,
  retentionEnLigne: false,
};

export interface EntreeDelai {
  procedure: CodeProcedure;
  /** Date de réception (notification) déclarée ou lue ; à défaut, date de la décision. */
  dateReference?: Date;
  /** Pour un refus implicite : date de dépôt de la demande ou d'envoi du recours préalable. */
  dateDemande?: Date;
  silenceApresRecoursPrealable?: boolean;
  /** Procédure en cours : prochaine échéance fixée par le tribunal (mémoire, audience). */
  dateEcheance?: Date;
  situationOQTF?: SituationOQTF;
  aujourdhui: Date;
}

export type Traitement =
  | "NORMAL" // procédure engagée, avis préalable possible
  | "DIRECT" // moins de 10 jours ou date inconnue : pas d'avis préalable
  | "URGENCE" // moins de 3 jours ouvrés : requête sommaire, majoration
  | "EXPIRE" // délai déclaré dépassé : seule la vérification par un avocat (avis) est proposée
  | "REFUSE"; // rétention ou détention : pas de dépôt en ligne

export interface ResultatDelai {
  traitement: Traitement;
  dateLimite?: Date;
  joursRestants?: number; // calendaires
  joursOuvresRestants?: number;
  avisPossible: boolean;
  /** Le refus implicite n'est pas encore né : on ne peut pas encore former le recours. */
  refusImpliciteNonNe?: { dateNaissance: Date };
  dateInconnue: boolean;
  motifRefus?: "RETENTION" | "DETENTION";
}

export function dateLimite(e: EntreeDelai, p: ParametresDelais = DELAIS_DEFAUT): Date | undefined {
  const ref = e.dateReference;
  switch (e.procedure) {
    case "OQTF": {
      if (!ref) return undefined;
      switch (e.situationOQTF ?? "LIBRE") {
        case "LIBRE":
          return ajouterMois(ref, p.oqtfLibreMois);
        case "ASSIGNE":
          return ajouterJours(ref, p.oqtfAssigneJours);
        case "DETENTION":
          return ajouterJours(ref, p.oqtfDetentionJours);
        case "RETENTION":
          return ajouterJours(ref, Math.ceil(p.oqtfRetentionHeures / 24));
        case "LIBRE_APRES_ASILE":
          return ajouterJours(ref, p.oqtfApresAsileJours);
        case "INCONNUE":
          return ajouterJours(ref, Math.min(p.oqtfAssigneJours, p.oqtfApresAsileJours));
      }
    }
    // falls through (inatteignable)
    case "REFUS_TITRE":
      return ref ? ajouterMois(ref, p.refusTitreMois) : undefined;
    case "REFUS_VISA":
      return ref ? ajouterJours(ref, p.visaRecoursJours) : undefined;
    case "NATURALISATION":
      return ref ? ajouterMois(ref, p.naturalisationMois) : undefined;
    case "REFUS_IMPLICITE": {
      if (!e.dateDemande) return undefined;
      const naissance = ajouterMois(
        e.dateDemande,
        e.silenceApresRecoursPrealable ? p.silenceRecoursMois : p.silenceDemandeMois,
      );
      return ajouterMois(naissance, p.recoursImpliciteMois);
    }
    case "PROCEDURE_EN_COURS":
      return e.dateEcheance;
    default:
      return undefined; // blocages, diagnostic : pas de délai calculé ici
  }
}

export function evaluerDelai(e: EntreeDelai, p: ParametresDelais = DELAIS_DEFAUT): ResultatDelai {
  if (e.procedure === "OQTF") {
    if (e.situationOQTF === "RETENTION" && !p.retentionEnLigne)
      return { traitement: "REFUSE", motifRefus: "RETENTION", avisPossible: false, dateInconnue: !e.dateReference };
    if (e.situationOQTF === "DETENTION" && !p.detentionEnLigne)
      return { traitement: "REFUSE", motifRefus: "DETENTION", avisPossible: false, dateInconnue: !e.dateReference };
  }

  if (e.procedure === "REFUS_IMPLICITE" && e.dateDemande) {
    const naissance = ajouterMois(
      e.dateDemande,
      e.silenceApresRecoursPrealable ? p.silenceRecoursMois : p.silenceDemandeMois,
    );
    if (naissance.getTime() > e.aujourdhui.getTime()) {
      return { traitement: "NORMAL", avisPossible: true, dateInconnue: false, refusImpliciteNonNe: { dateNaissance: naissance } };
    }
  }

  const limite = dateLimite(e, p);
  if (!limite) {
    const sansDelai = ["BLOCAGE_EMPLOI", "BLOCAGE_SIMPLE", "PROCEDURE_EN_COURS", "DIAGNOSTIC"].includes(e.procedure);
    const avisSansDelai = sansDelai && !["PROCEDURE_EN_COURS", "DIAGNOSTIC"].includes(e.procedure);
    return { traitement: sansDelai ? "NORMAL" : "DIRECT", avisPossible: avisSansDelai, dateInconnue: !sansDelai };
  }

  const joursRestants = ecartJours(e.aujourdhui, limite);
  if (e.procedure === "PROCEDURE_EN_COURS" && joursRestants < 0) {
    // Échéance passée (audience déjà tenue, date erronée) : l'avocat fait le point, sans blocage.
    return { traitement: "NORMAL", avisPossible: false, dateInconnue: false };
  }
  if (joursRestants < 0) {
    return { traitement: "EXPIRE", dateLimite: limite, joursRestants, joursOuvresRestants: 0, avisPossible: true, dateInconnue: false };
  }
  // Jours ouvrés restants après aujourd'hui (la journée entamée ne compte pas : règle de prudence).
  const joursOuvresRestants = joursOuvresEntre(e.aujourdhui, limite);
  if (joursOuvresRestants < p.seuilUrgenceJoursOuvres) {
    return { traitement: "URGENCE", dateLimite: limite, joursRestants, joursOuvresRestants, avisPossible: false, dateInconnue: false };
  }
  // Pas d'avis préalable pour une procédure déjà en cours (cahier des charges, 4.11).
  const avisPossible = joursRestants >= p.avisPossibleJoursCalendaires && e.procedure !== "PROCEDURE_EN_COURS";
  return {
    traitement: avisPossible ? "NORMAL" : "DIRECT",
    dateLimite: limite,
    joursRestants,
    joursOuvresRestants,
    avisPossible,
    dateInconnue: false,
  };
}
