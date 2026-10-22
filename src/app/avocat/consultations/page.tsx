// Lot 3 : consultations — avis et diagnostics écrits, à rendre sous 48 heures ouvrées après le paiement.
import Link from "next/link";
import { db } from "@/db";
import { PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { consultations, type OngletConsultations } from "@/lib/serveur/agenda";
import { frDateHeure, LIBELLES_STATUT, type Statut } from "@/lib/statuts";
import { ActionForm } from "../Actions";
import { Cadre } from "../cadre";

export const metadata = { title: "Consultations — Espace cabinet", robots: { index: false } };
const proc = (p: string) => PROCEDURES[p as CodeProcedure]?.libelle ?? p;
const ONGLETS: [OngletConsultations, string][] = [
  ["a_rendre", "Avis à rendre"],
  ["transmis", "Avis transmis"],
  ["toutes", "Toutes"],
];

export default function Consultations({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  return (
    <Cadre actif="consultations">
      {async (m) => {
        const { onglet: o } = await searchParams;
        const onglet = (ONGLETS.find(([k]) => k === o)?.[0] ?? "a_rendre") as OngletConsultations;
        const lignes = await consultations(await db(), m, onglet);
        const tous = m.role === "ASSOCIE" || m.role === "SECRETARIAT";
        const maintenant = new Date();
        return (
          <>
            <nav className="tabs esp-tabs sous" aria-label="Consultations">
              {ONGLETS.map(([k, l]) => (
                <Link key={k} href={`/avocat/consultations?onglet=${k}`} className={k === onglet ? "on" : ""} aria-current={k === onglet ? "page" : undefined}>
                  {l}
                </Link>
              ))}
            </nav>
            <p className="note">
              L&apos;avis se rédige dans le poste de travail du dossier (modèle « Avis écrit au client »), puis s&apos;atteste. Une fois transmis, il apparaît dans l&apos;espace du client,
              rubrique « Documents », et le dossier est clos.
            </p>
            <section className="card">
              {lignes.length === 0 ? (
                <p className="vide">{onglet === "a_rendre" ? "Aucun avis à rendre." : "Aucune consultation."}</p>
              ) : (
                <ul className="esp-lignes">
                  {lignes.map((x) => {
                    const retard = !x.dos.avisTransmisLe && x.rendreAvant && x.rendreAvant < maintenant;
                    const proche = !x.dos.avisTransmisLe && x.rendreAvant && x.rendreAvant.getTime() - maintenant.getTime() < 8 * 3_600_000;
                    return (
                      <li key={x.dos.id}>
                        <Link href={`/avocat/dossiers/${x.dos.reference}?onglet=travail`}>
                          <b>{x.dos.reference}</b> · {x.cli.prenom} {x.cli.nom} · {x.dos.avisPrealable ? "Avis écrit d'un avocat" : proc(x.dos.procedure)}
                          {tous && x.avocat?.prenom ? ` · Me ${x.avocat.prenom} ${x.avocat.nom}` : ""}
                        </Link>
                        <span className="cab-actions">
                          {x.dos.avisTransmisLe ? (
                            <span className="pill ok">transmis le {frDateHeure(x.dos.avisTransmisLe)}</span>
                          ) : (
                            <>
                              <span className={`pill ${retard ? "bad" : proche ? "warn" : "n"}`}>
                                {x.rendreAvant ? `à rendre avant ${frDateHeure(x.rendreAvant)}` : "paiement non reçu"}
                              </span>
                              <span className="pill n">{x.avisPret ? "avis attesté" : x.aUnProjet ? "avis en rédaction" : LIBELLES_STATUT[x.dos.statut as Statut]}</span>
                              {x.avisPret && (
                                <ActionForm
                                  api="/api/avocat/suivi"
                                  base={{ reference: x.dos.reference, action: "transmettreAvis" }}
                                  libelle="Transmettre l'avis au client"
                                  confirmation="L'avis attesté sera visible par le client et le dossier sera clos."
                                />
                              )}
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        );
      }}
    </Cadre>
  );
}
