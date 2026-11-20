// « Ma journée » : une seule liste de tâches par personne, classée par urgence.
// Principe : aucune échéance ne doit être manquée, sans noyer l'avocat. Une ligne par chose à faire, jamais de doublon,
// l'urgent d'abord, la semaine ensuite, le reste replié.

export type Niveau = "URGENT" | "SEMAINE" | "SUIVI";

export interface DossierTache {
  ref: string;
  client: string;
  procedure: string;
  statut: string;
  urgence: boolean;
  avis: boolean; // avis écrit ou diagnostic (rendu dans « Avis à rendre »)
  dateLimite: string | null; // AAAA-MM-JJ
  acceptationAvant: Date | null;
  transmis: boolean;
  avocat: string | null;
  piecesAVerifier: number;
  piecesManquantes: number;
  messagesNonLus: number;
}

export interface Tache {
  ref: string;
  client: string;
  procedure: string;
  avocat: string | null;
  libelle: string;
  echeance: string | null; // AAAA-MM-JJ
  heure: Date | null;
  niveau: Niveau;
  onglet: "travail" | "echanges" | "pieces" | "dossier";
}

const LIB_ECHEANCE: Record<string, string> = {
  MEMOIRE_COMPLEMENTAIRE: "Produire le mémoire complémentaire",
  AUDIENCE: "Audience",
  CLOTURE: "Clôture de l'instruction",
  APPEL: "Décider de l'appel",
  REPONSE_MOTIFS: "Réponse de l'administration attendue",
};
const AVANT_DEPOT = ["PAYE", "PRIS_EN_CHARGE", "EN_REDACTION", "ACTE_ATTESTE"];

const jour = (d: Date) => d.toISOString().slice(0, 10);
const plus = (iso: string, n: number) => jour(new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86_400_000));

/** Niveau d'une tâche selon son échéance : dépassée ou à un jour → urgent ; sous sept jours → semaine ; sinon à suivre. */
export function niveau(echeance: string | null, aujourdhui: string, defaut: Niveau = "SEMAINE"): Niveau {
  if (!echeance) return defaut;
  if (echeance <= plus(aujourdhui, 1)) return "URGENT";
  if (echeance <= plus(aujourdhui, 7)) return "SEMAINE";
  return "SUIVI";
}

export function calculerTaches(
  dossiersActifs: DossierTache[],
  echeances: { ref: string; type: string; date: string }[],
  avis: { ref: string; client: string; avocat: string | null; rendreAvant: Date | null }[],
  role: string,
  aujourdhui = jour(new Date()),
): Tache[] {
  const secretariat = role === "SECRETARIAT";
  const t: Tache[] = [];
  const ajouter = (x: DossierTache, libelle: string, echeance: string | null, onglet: Tache["onglet"], defaut: Niveau = "SEMAINE", heure: Date | null = null) => {
    let n = niveau(echeance, aujourdhui, defaut);
    // Traitement en urgence payé par le client : prioritaire tant que le recours n'est pas déposé.
    if (x.urgence && AVANT_DEPOT.includes(x.statut) && onglet === "travail") n = "URGENT";
    t.push({ ref: x.ref, client: x.client, procedure: x.procedure, avocat: x.avocat, libelle, echeance, heure, niveau: n, onglet });
  };

  for (const x of dossiersActifs) {
    if (!secretariat) {
      if (x.statut === "PAYE") ajouter(x, "Accepter le dossier", x.acceptationAvant ? jour(x.acceptationAvant) : null, "travail", "URGENT", x.acceptationAvant);
      else if (!x.avis && x.statut === "PRIS_EN_CHARGE") ajouter(x, "Rédiger le recours", x.dateLimite, "travail");
      else if (!x.avis && x.statut === "EN_REDACTION") ajouter(x, "Finaliser et attester l'acte", x.dateLimite, "travail");
      else if (!x.avis && x.statut === "ACTE_ATTESTE" && !x.transmis) ajouter(x, "Transmettre au secrétariat pour le dépôt", x.dateLimite, "travail");
      if (x.piecesAVerifier > 0) ajouter(x, `Vérifier ${x.piecesAVerifier > 1 ? `${x.piecesAVerifier} pièces reçues` : "une pièce reçue"}`, null, "pieces", "SEMAINE");
    } else if (x.statut === "ACTE_ATTESTE" && x.transmis) {
      ajouter(x, "Déposer le recours", x.dateLimite, "travail", "URGENT");
    }
    if (x.messagesNonLus > 0) ajouter(x, `Répondre au client (${x.messagesNonLus} message${x.messagesNonLus > 1 ? "s" : ""})`, null, "echanges", "SEMAINE");
    // Relance des pièces manquantes : à suivre, sauf si le dépôt approche.
    if (x.piecesManquantes > 0 && AVANT_DEPOT.includes(x.statut))
      ajouter(x, `Relancer le client : ${x.piecesManquantes > 1 ? `${x.piecesManquantes} pièces manquantes` : "une pièce manquante"}`, null, "pieces", x.dateLimite && x.dateLimite <= plus(aujourdhui, 7) ? "SEMAINE" : "SUIVI");
  }

  // Échéances de procédure (la date limite du recours est déjà portée par la tâche de rédaction tant que rien n'est déposé).
  const parRef = new Map(dossiersActifs.map((x) => [x.ref, x]));
  for (const e of echeances) {
    const x = parRef.get(e.ref);
    if (!x) continue;
    if (e.type === "DATE_LIMITE" && AVANT_DEPOT.includes(x.statut)) continue;
    if (secretariat && e.type !== "AUDIENCE") continue;
    const libelle = e.type === "DATE_LIMITE" ? "Date limite" : (LIB_ECHEANCE[e.type] ?? e.type);
    t.push({ ref: x.ref, client: x.client, procedure: x.procedure, avocat: x.avocat, libelle, echeance: e.date, heure: null, niveau: niveau(e.date, aujourdhui, "SUIVI"), onglet: "dossier" });
  }

  if (!secretariat)
    for (const a of avis) {
      const echeance = a.rendreAvant ? jour(a.rendreAvant) : null;
      t.push({ ref: a.ref, client: a.client, procedure: "DIAGNOSTIC", avocat: a.avocat, libelle: "Rendre l'avis écrit", echeance, heure: a.rendreAvant, niveau: niveau(echeance, aujourdhui), onglet: "travail" });
    }

  const rang: Record<Niveau, number> = { URGENT: 0, SEMAINE: 1, SUIVI: 2 };
  return t.sort((a, b) => rang[a.niveau] - rang[b.niveau] || (a.echeance ?? "9999").localeCompare(b.echeance ?? "9999") || a.ref.localeCompare(b.ref));
}

export interface EcheanceAvocat {
  ref: string;
  client: string;
  procedure: string;
  avocatId: string;
  avocat: string | null;
  libelle: string;
  date: string; // AAAA-MM-JJ
}
export interface Absence {
  avocatId: string;
  debut: string; // AAAA-MM-JJ
  fin: string;
  motif: string;
}
export interface AlerteAbsence extends EcheanceAvocat {
  absence: Absence;
}

/** Échéances qui tombent pendant une absence de l'avocat chargé du dossier : à réattribuer ou à anticiper. */
export function alertesAbsence(echeances: EcheanceAvocat[], absences: Absence[], aujourdhui = jour(new Date())): AlerteAbsence[] {
  const res: AlerteAbsence[] = [];
  for (const e of echeances) {
    if (e.date < aujourdhui) continue;
    const a = absences.find((x) => x.avocatId === e.avocatId && x.debut <= e.date && e.date <= x.fin);
    if (a) res.push({ ...e, absence: a });
  }
  return res.sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
}
