// Données de la collecte après paiement (questions, faits à confirmer, pièces déjà transmises).
// Servies seulement au détenteur du jeton du dossier : la référence seule (D1001, D1002…) ne donne accès à rien.
import { eq } from "drizzle-orm";
import type { Base } from "@/db";
import { schema } from "@/db";
import { casDuTriage } from "@/lib/cas";
import { memeFamille, type CodeProcedure } from "@/lib/procedures";
import type { Contexte, Reponses } from "@/lib/questionnaire";
import { lireParametre } from "./parametres";

export interface DonneesCollecte {
  contexte: Contexte;
  reponsesInitiales: Reponses;
  faits: string[];
  deposees: string[];
}

export async function donneesCollecte(d: Base, dossierId: string): Promise<DonneesCollecte | null> {
  const [dos] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, dossierId));
  if (!dos) return null;
  const casDossier = casDuTriage(await lireParametre(d, "cas"), dos.triage as { cas?: string; casLibre?: unknown } | null);
  const cas = casDossier && memeFamille(casDossier.procedure, dos.procedure) ? casDossier : undefined;
  const qualif = (dos.qualification ?? {}) as { prefecture?: string | null; reponses?: Reponses };
  const [client] = await d.select().from(schema.clients).where(eq(schema.clients.id, dos.clientId));
  const deposees = (await d.select({ type: schema.pieces.type, fichiers: schema.pieces.fichiers }).from(schema.pieces).where(eq(schema.pieces.dossierId, dos.id)))
    .filter((x) => Array.isArray(x.fichiers) && x.fichiers.length > 0)
    .map((x) => x.type);
  return {
    contexte: {
      procedure: dos.procedure as CodeProcedure,
      algerien: client?.algerien ?? null,
      avisOuDiagnostic: dos.avisPrealable || dos.procedure === "DIAGNOSTIC",
      cas: cas?.code,
      pieces: cas?.pieces.length ? cas.pieces : undefined,
      implicite: !!cas?.implicite,
      prefectureConnue: !!qualif.prefecture,
    },
    reponsesInitiales: qualif.reponses ?? {},
    faits: ((dos.triage ?? {}) as { faits?: string[] }).faits ?? [],
    deposees,
  };
}
