// Données du poste de travail, préparées côté serveur pour le composant PosteTravail.
import { desc, eq } from "drizzle-orm";
import type { Base } from "@/db";
import { actes, pieces } from "@/db/schema";
import { LIBELLES_MODELE, type CodeModele } from "@/lib/modeles";
import type { Dossier } from "@/lib/serveur/dossiers";
import { attestationPossible, attestationValide, controleCroise, modelesDuDossier, texteAttestation, type Analyse } from "@/lib/serveur/poste";
import type { Membre } from "@/lib/serveur/session";
import type { FichierStocke } from "@/lib/serveur/stockage";
import { frDateHeure } from "@/lib/statuts";
import { attestationsClient, TITRE_ATTESTATION } from "@/lib/attestations";
import type { ProprietesPoste } from "./PosteTravail";

export async function donneesPoste(d: Base, dos: Dossier, m: Membre): Promise<ProprietesPoste> {
  const tous = await d.select().from(actes).where(eq(actes.dossierId, dos.id)).orderBy(desc(actes.creeLe), desc(actes.version));
  const acte = tous[0] ?? null;
  const memeType = acte ? tous.filter((a) => a.type === acte.type) : [];
  const att = await attestationValide(d, acte);
  const possible = await attestationPossible(d, dos);
  const lesPieces = await d.select().from(pieces).where(eq(pieces.dossierId, dos.id)).orderBy(pieces.numero, pieces.creeLe);
  return {
    reference: dos.reference,
    analyse: (dos.analyse as Analyse | null) ?? null,
    acte: acte ? { id: acte.id, type: acte.type, version: acte.version, contenu: acte.contenu, motsModifies: acte.motsModifies, tempsRevueS: acte.tempsRevueS, sources: (acte.sources as { titre: string; lien: string }[] | null) ?? [] } : null,
    versions: memeType.map((a) => ({ id: a.id, version: a.version, le: frDateHeure(a.creeLe), mots: a.motsModifies })),
    modeles: (await modelesDuDossier(d, dos)).map((c) => [c, LIBELLES_MODELE[c]]),
    libelleActe: acte ? (LIBELLES_MODELE[acte.type as CodeModele] ?? acte.type) : null,
    controle: await controleCroise(d, dos),
    attestation: att ? { le: frDateHeure(att.le), version: att.version } : null,
    texteAttestation: texteAttestation(`Maître ${m.prenom} ${m.nom}`),
    peutAttester: m.role === "ASSOCIE" || (m.role === "AVOCAT" && dos.avocatId === m.id),
    transmisLe: dos.transmisSecretariatLe ? frDateHeure(dos.transmisSecretariatLe) : null,
    attestationsClient: attestationsClient(dos.priseEnCharge).map((a) => ({ titre: TITRE_ATTESTATION[a.type], le: frDateHeure(new Date(a.le)) })),
    attestationASigner: possible.type,
    attestationRaison: possible.type ? "" : possible.raison,
    dateLimiteVerifiee: dos.dateLimiteVerifiee,
    avisTransmisLe: dos.avisTransmisLe ? frDateHeure(dos.avisTransmisLe) : null,
    pieces: lesPieces
      .map((x) => ({
        id: x.id,
        libelle: `${x.numero ? `${x.numero}. ` : ""}${x.libelle}`,
        fichiers: ((x.fichiers as FichierStocke[] | null) ?? []).map((f, i) => ({ i, nom: f.nom, mime: f.mime })),
      }))
      .filter((x) => x.fichiers.length > 0),
  };
}
