// Lot 3 : liste des dossiers (à prendre en charge, en cours, terminés, tous), recherche.
import Link from "next/link";
import { db } from "@/db";
import { PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { compteurs, dossiersEquipe, type Filtre } from "@/lib/serveur/dossiers";
import { frDate, LIBELLES_STATUT, type Statut } from "@/lib/statuts";
import { Cadre } from "../cadre";

export const metadata = { title: "Dossiers — Espace cabinet", robots: { index: false } };

const FILTRES: [Filtre, string, "aPrendre" | "enCours" | "termines" | "tous"][] = [
  ["a_prendre", "À prendre en charge", "aPrendre"],
  ["en_cours", "En cours", "enCours"],
  ["termines", "Terminés", "termines"],
  ["tous", "Tous", "tous"],
];

export default async function Dossiers({ searchParams }: { searchParams: Promise<{ filtre?: string; q?: string }> }) {
  const sp = await searchParams;
  const filtre = (FILTRES.find(([f]) => f === sp.filtre)?.[0] ?? "en_cours") as Filtre;
  return (
    <Cadre actif="dossiers">
      {async (m) => {
        const d = await db();
        const [liste, c] = await Promise.all([dossiersEquipe(d, m, filtre, sp.q), compteurs(d, m)]);
        return (
          <>
            <div className="cab-barre">
              <div className="chips">
                {FILTRES.map(([f, l, k]) => (
                  <Link key={f} href={`/avocat/dossiers?filtre=${f}`} className={`chip-f ${f === filtre ? "on" : ""}`}>
                    {l} <span>{c[k]}</span>
                  </Link>
                ))}
              </div>
              <form className="cab-recherche" action="/avocat/dossiers">
                <input type="hidden" name="filtre" value={filtre} />
                <input className="champ" name="q" defaultValue={sp.q ?? ""} placeholder="Rechercher : référence, nom, e-mail…" aria-label="Rechercher un dossier" />
              </form>
            </div>
            <div className="tbl-w">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Réf.</th>
                    <th>Client</th>
                    <th>Dossier</th>
                    <th>Avocat</th>
                    <th>Étape</th>
                    <th>Date limite</th>
                  </tr>
                </thead>
                <tbody>
                  {liste.map(({ dos, cli, avocat }) => (
                    <tr key={dos.id}>
                      <td>
                        <Link href={`/avocat/dossiers/${dos.reference}`}>
                          <b>{dos.reference}</b>
                        </Link>
                        {dos.traitement === "URGENCE" && <span className="pill bad">Urgent</span>}
                      </td>
                      <td>
                        {cli.prenom} {cli.nom} {cli.algerien && <span className="pill warn">DZ</span>}
                      </td>
                      <td>{PROCEDURES[dos.procedure as CodeProcedure]?.libelle ?? dos.procedure}</td>
                      <td>{avocat?.nom ? `Me ${avocat.prenom} ${avocat.nom}` : "—"}</td>
                      <td>
                        <span className={`pill ${dos.statut === "PAYE" ? "warn" : "n"}`}>{LIBELLES_STATUT[dos.statut as Statut]}</span>
                      </td>
                      <td>
                        {dos.dateLimite ? frDate(dos.dateLimite) : "—"}{" "}
                        {dos.dateLimite && <span className={`pill ${dos.dateLimiteVerifiee ? "ok" : "warn"}`}>{dos.dateLimiteVerifiee ? "vérifiée" : "estimée"}</span>}
                      </td>
                    </tr>
                  ))}
                  {liste.length === 0 && (
                    <tr>
                      <td colSpan={6} className="vide">
                        Aucun dossier.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        );
      }}
    </Cadre>
  );
}
