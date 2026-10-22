// Lot 3 : indicateurs du cabinet, réservés aux associés.
import Link from "next/link";
import { db } from "@/db";
import { formatEuros, LIBELLES_DILIGENCE, PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { indicateurs, PERIODES, type Periode } from "@/lib/serveur/indicateurs";
import { frDate } from "@/lib/statuts";
import { Cadre } from "../cadre";

export const metadata = { title: "Indicateurs — Espace cabinet", robots: { index: false } };

const libelleProcedure = (c: string) => (c === "APPEL" ? LIBELLES_DILIGENCE.APPEL : c === "AVIS_PREALABLE" ? LIBELLES_DILIGENCE.AVIS_PREALABLE : (PROCEDURES[c as CodeProcedure]?.libelle ?? c));
const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)} %`);
const nb = (x: number | null, unite: string, dec = 0) => (x == null ? "—" : `${x.toLocaleString("fr-FR", { maximumFractionDigits: dec })} ${unite}`);
const MODES: Record<string, string> = {
  COLLABORATEUR_FIXE_VARIABLE: "Fixe et variable",
  A_L_ACTE: "À l'acte",
  AUCUNE: "—",
};

export default function Indicateurs({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  return (
    <Cadre actif="indicateurs">
      {async (m) => {
        if (m.role !== "ASSOCIE")
          return (
            <section className="card">
              <p className="vide">Les indicateurs sont réservés aux associés.</p>
            </section>
          );
        const { periode: p } = await searchParams;
        const periode = (PERIODES.find(([k]) => k === p)?.[0] ?? "30") as Periode;
        const x = await indicateurs(await db(), periode);
        const max = Math.max(1, ...x.parProcedure.map(([, v]) => v.montant));
        return (
          <>
            <nav className="tabs esp-tabs sous" aria-label="Période">
              {PERIODES.map(([k, l]) => (
                <Link key={k} href={`/avocat/indicateurs?periode=${k}`} className={k === periode ? "on" : ""} aria-current={k === periode ? "page" : undefined}>
                  {l}
                </Link>
              ))}
            </nav>
            <div className="cab-grille">
              <section className="cab-kpi">
                <div className="kpi">
                  <b>{x.dossiersPayes}</b>
                  <span>Dossiers réglés</span>
                </div>
                <div className="kpi">
                  <b>{formatEuros(x.encaisse)}</b>
                  <span>Honoraires encaissés TTC</span>
                </div>
                <div className="kpi">
                  <b>{pct(x.tauxSous48h)}</b>
                  <span>Pris en charge sous 48 heures ouvrées ({x.acceptes} acceptés)</span>
                </div>
                <div className="kpi">
                  <b>{nb(x.delaiAcceptationH, "h", 1)}</b>
                  <span>Délai moyen d&apos;acceptation</span>
                </div>
                <div className="kpi">
                  <b>{nb(x.delaiDepotJ, "j", 1)}</b>
                  <span>Délai moyen du paiement au dépôt ({x.deposes} dépôts)</span>
                </div>
                <div className="kpi">
                  <b>{x.horsDelai}</b>
                  <span>Dépôts après la date limite</span>
                </div>
                <div className="kpi">
                  <b>{x.rembourses}</b>
                  <span>Remboursements</span>
                </div>
              </section>

              {x.enSouffrance.length > 0 && (
                <section className="card cab-large">
                  <h2>
                    Date limite passée sans dépôt <span className="pill bad">{x.enSouffrance.length}</span>
                  </h2>
                  <ul className="esp-lignes">
                    {x.enSouffrance.map((e) => (
                      <li key={e.reference}>
                        <Link href={`/avocat/dossiers/${e.reference}`}>
                          <b>{e.reference}</b>
                        </Link>
                        <span className="pill bad">date limite {frDate(e.dateLimite)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="card">
                <h2>Par procédure</h2>
                {x.parProcedure.length === 0 ? (
                  <p className="vide">Aucun règlement sur la période.</p>
                ) : (
                  <ul className="ind-barres">
                    {x.parProcedure.map(([c, v]) => (
                      <li key={c}>
                        <span className="ind-lib">
                          {libelleProcedure(c)} <small>· {v.n} dossier(s)</small>
                        </span>
                        <span className="ind-barre">
                          <span style={{ width: `${(v.montant / max) * 100}%` }} />
                        </span>
                        <b>{formatEuros(v.montant)}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card cab-large">
                <h2>Par avocat</h2>
                <div className="tbl-defil">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Avocat</th>
                        <th>Dossiers reçus</th>
                        <th>Acceptés sous 48 h</th>
                        <th>Actes attestés</th>
                        <th>Avis transmis</th>
                        <th>Mots modifiés (moy.)</th>
                        <th>Revue (moy.)</th>
                        <th>Base HT</th>
                        <th>Variable HT estimé</th>
                      </tr>
                    </thead>
                    <tbody>
                      {x.parAvocat.map((a) => (
                        <tr key={a.id}>
                          <td>
                            Me {a.nom}
                            <small className="ind-mode">{MODES[a.mode] ?? a.mode}</small>
                          </td>
                          <td>{a.recus}</td>
                          <td>{a.acceptes ? `${a.acceptesSous48h} / ${a.acceptes}` : "—"}</td>
                          <td>{a.actesAttestes}</td>
                          <td>{a.avisTransmis}</td>
                          <td>{nb(a.motsModifiesMoyen, "")}</td>
                          <td>{nb(a.revueMoyenneMin, "min")}</td>
                          <td>{formatEuros(a.baseHT)}</td>
                          <td>{a.variableHT == null ? "—" : formatEuros(a.variableHT)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="note">
                  Base HT : honoraires réglés (hors remboursements) des dossiers dont l&apos;avocat a attesté un acte sur la période, comptés une fois par dossier. Le variable est une
                  estimation selon le seuil et le taux enregistrés pour le collaborateur ; il est validé par un associé avant tout règlement.
                </p>
              </section>
            </div>
          </>
        );
      }}
    </Cadre>
  );
}
