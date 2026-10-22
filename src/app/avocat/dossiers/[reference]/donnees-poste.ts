// Données du poste de travail, préparées côté serveur pour le composant PosteTravail.
import { desc, eq } from "drizzle-orm";
import type { Base } from "@/db";
import { actes } from "@/db/schema";
import { LIBELLES_MODELE, modelesPour, type CodeModele } from "@/lib/modeles";
import type { Dossier } from "@/lib/serveur/dossiers";
import { attestationValide, controleCroise, texteAttestation, type Analyse } from "@/lib/serveur/poste";
import type { Membre } from "@/lib/serveur/session";
import { frDateHeure } from "@/lib/statuts";
import type { ProprietesPoste } from "./PosteTravail";

export async function donneesPoste(d: Base, dos: Dossier, m: Membre): Promise<ProprietesPoste> {
  const tous = await d.select().from(actes).where(eq(actes.dossierId, dos.id)).orderBy(desc(actes.creeLe), desc(actes.version));
  const acte = tous[0] ?? null;
  const memeType = acte ? tous.filter((a) => a.type === acte.type) : [];
  const att = await attestationValide(d, acte);
  const pc = dos.priseEnCharge as { le: string } | null;
  return {
    reference: dos.reference,
    analyse: (dos.analyse as Analyse | null) ?? null,
    acte: acte ? { id: acte.id, type: acte.type, version: acte.version, contenu: acte.contenu, motsModifies: acte.motsModifies, tempsRevueS: acte.tempsRevueS } : null,
    versions: memeType.map((a) => ({ id: a.id, version: a.version, le: frDateHeure(a.creeLe), mots: a.motsModifies })),
    modeles: modelesPour(dos.procedure, dos.avisPrealable, !!dos.dossierParentId).map((c) => [c, LIBELLES_MODELE[c]]),
    libelleActe: acte ? (LIBELLES_MODELE[acte.type as CodeModele] ?? acte.type) : null,
    controle: await controleCroise(d, dos),
    attestation: att ? { le: frDateHeure(att.le), version: att.version } : null,
    texteAttestation: texteAttestation(`Maître ${m.prenom} ${m.nom}`),
    peutAttester: m.role === "ASSOCIE" || (m.role === "AVOCAT" && dos.avocatId === m.id),
    transmisLe: dos.transmisSecretariatLe ? frDateHeure(dos.transmisSecretariatLe) : null,
    priseEnCharge: pc ? { le: frDateHeure(new Date(pc.le)) } : null,
    dateLimiteVerifiee: dos.dateLimiteVerifiee,
    avisTransmisLe: dos.avisTransmisLe ? frDateHeure(dos.avisTransmisLe) : null,
  };
}
