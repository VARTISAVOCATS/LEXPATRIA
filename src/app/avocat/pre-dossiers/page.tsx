// Pré-dossiers : parcours arrêtés avant le paiement. Un associé peut décider d'une intervention sans honoraires.
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { preDossiers } from "@/lib/serveur/probono";
import { frDate, frDateHeure } from "@/lib/statuts";
import { ActionForm } from "../Actions";
import { Cadre } from "../cadre";

export const metadata = { title: "Pré-dossiers — Espace cabinet", robots: { index: false } };

export default async function PreDossiers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  return (
    <Cadre actif="predossiers">
      {async (m) => {
        if (m.role !== "ASSOCIE") return <p className="vide">Réservé aux associés.</p>;
        const d = await db();
        const q = (sp.q ?? "").trim().toLowerCase();
        const liste = (await preDossiers(d)).filter(
          ({ dos, cli }) => !q || [dos.reference, cli.prenom, cli.nom, cli.email].some((v) => (v ?? "").toLowerCase().includes(q)),
        );
        const avocats = (await d.select().from(schema.utilisateurs).where(eq(schema.utilisateurs.actif, true))).filter((u) => u.role === "AVOCAT" || u.role === "ASSOCIE");
        const options: [string, string][] = avocats.map((u) => [u.id, `Me ${u.prenom} ${u.nom}`]);
        return (
          <>
            <p className="note">
              Parcours arrêtés avant le paiement. Pour prendre un dossier sans honoraires, choisissez l&apos;avocat : le client reçoit par e-mail la convention
              d&apos;intervention sans honoraires. Dès qu&apos;il l&apos;accepte, le dossier est pris en charge par l&apos;avocat choisi.
            </p>
            <form className="cab-recherche" action="/avocat/pre-dossiers">
              <input className="champ" name="q" defaultValue={sp.q ?? ""} placeholder="Rechercher : référence, nom, e-mail…" aria-label="Rechercher un pré-dossier" />
            </form>
            <div className="tbl-w">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Réf.</th>
                    <th>Client</th>
                    <th>Dossier</th>
                    <th>Créé le</th>
                    <th>Date limite</th>
                    <th>Sans honoraires</th>
                  </tr>
                </thead>
                <tbody>
                  {liste.map(({ dos, cli }) => (
                    <tr key={dos.id}>
                      <td>
                        <b>{dos.reference}</b>
                      </td>
                      <td>
                        {cli.prenom} {cli.nom}
                        <br />
                        <span className="note">{cli.email}</span>
                      </td>
                      <td>{PROCEDURES[dos.procedure as CodeProcedure]?.libelle ?? dos.procedure}</td>
                      <td>{frDateHeure(dos.creeLe)}</td>
                      <td>{dos.dateLimite ? frDate(dos.dateLimite) : "—"}</td>
                      <td>
                        {dos.proBono ? (
                          <span className="pill ok">Proposé · en attente du client</span>
                        ) : (
                          <ActionForm
                            api="/api/avocat/pro-bono"
                            base={{ reference: dos.reference }}
                            champs={[{ nom: "avocatId", type: "select", label: "Avocat", options, defaut: options[0]?.[0], requis: true }]}
                            libelle="Prendre sans honoraires"
                            confirmation={`Proposer à ${cli.prenom ?? ""} ${cli.nom ?? ""} une intervention sans honoraires ?`}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                  {liste.length === 0 && (
                    <tr>
                      <td colSpan={6} className="vide">
                        Aucun pré-dossier.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="note">
              <Link href="/avocat/dossiers">Retour aux dossiers</Link>
            </p>
          </>
        );
      }}
    </Cadre>
  );
}
