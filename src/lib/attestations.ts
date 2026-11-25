// Attestations remises au client (espace client, PDF) :
// - PRISE_EN_CHARGE : recours gracieux, recours préalable ou mise en demeure, dès la prise en charge ;
// - DEPOT : après le dépôt d'une requête devant la juridiction, avec la date, la juridiction et le numéro.
// Un même dossier peut en compter plusieurs (prise en charge pour le recours gracieux, puis dépôt de la requête en annulation).

export type TypeAttestation = "PRISE_EN_CHARGE" | "DEPOT";

export interface AttestationClient {
  type: TypeAttestation;
  texte: string;
  le: string; // ISO
  avocatId: string;
  empreinte: string;
  acteId?: string | null;
  depot?: { date: string | null; juridiction: string | null; numero: string | null } | null;
}

/** Lecture tolérante : ancienne forme (un seul objet) ou liste. */
export function attestationsClient(valeur: unknown): AttestationClient[] {
  if (!valeur) return [];
  if (Array.isArray(valeur)) return valeur as AttestationClient[];
  const v = valeur as Omit<AttestationClient, "type"> & { type?: TypeAttestation };
  return [{ ...v, type: v.type ?? (v.depot ? "DEPOT" : "PRISE_EN_CHARGE") }];
}

export const TITRE_ATTESTATION: Record<TypeAttestation, string> = {
  PRISE_EN_CHARGE: "Attestation de prise en charge",
  DEPOT: "Attestation de dépôt du recours",
};
