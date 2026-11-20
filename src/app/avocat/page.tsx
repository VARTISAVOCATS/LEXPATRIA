// Tableau de bord de l'espace cabinet.
// Avocat : bandeau des nouveaux dossiers, « Ma journée » (tâches par urgence), rendez-vous du jour. Rien n'est caché : listes complètes.
// Vision du cabinet (associés et membres autorisés en back office) : alertes, nouveaux dossiers et urgences de toute l'équipe.
// Secrétariat : dépôts à faire, pièces à relancer, audiences à venir.
import Link from "next/link";
import { db } from "@/db";
import { PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { tableauDeBord, tableauSecretariat, MOTIFS_ABSENCE } from "@/lib/serveur/cabinet";
import { voitTout } from "@/lib/serveur/dossiers";
import type { Membre } from "@/lib/serveur/session";
import { frDate } from "@/lib/statuts";
import type { Niveau, Tache } from "@/lib/taches";
import { Cadre } from "./cadre";

export const metadata = { title: "Espace cabinet — LEXPATRIA", robots: { index: false } };

const proc = (p: string) => PROCEDURES[p as CodeProcedure]?.libelle ?? p;
const JOURS = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
const HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const JOUR_HEURE = new Intl.DateTimeFormat("fr-FR", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const jourParis = (x: Date) => x.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
const ecart = (iso: string, aujourdhui: string) => Math.round((new Date(`${iso}T12:00:00Z`).getTime() - new Date(`${aujourdhui}T12:00:00Z`).getTime()) / 86_400_000);
const dossier = (ref: string, onglet = "travail") => `/avocat/dossiers/${ref}?onglet=${onglet}`;

function quand(t: Tache, aujourdhui: string): { texte: string; classe: string } {
  if (!t.echeance) return { texte: "à faire", classe: "n" };
  const j = ecart(t.echeance, aujourdhui);
  const heure = t.heure ? ` à ${HEURE.format(t.heure)}` : "";
  if (j < 0) return { texte: `en retard (${frDate(t.echeance)})`, classe: "bad" };
  if (j === 0) return { texte: `aujourd'hui${heure}`, classe: "bad" };
  if (j === 1) return { texte: `demain${heure}`, classe: "bad" };
  return { texte: `${frDate(t.echeance)} · dans ${j} jours`, classe: j <= 7 ? "warn" : "n" };
}

/** Échéance d'acceptation : rouge sous 24 heures, orange ensuite. */
function avantLe(avant: Date | null) {
  if (!avant) return { texte: "à accepter", classe: "warn" };
  const h = (avant.getTime() - Date.now()) / 3_600_000;
  if (h < 0) return { texte: "délai d'acceptation dépassé", classe: "bad" };
  const auj = jourParis(new Date());
  const j = ecart(jourParis(avant), auj);
  const texte = j === 0 ? `avant ${HEURE.format(avant)} aujourd'hui` : j === 1 ? `avant demain ${HEURE.format(avant)}` : `avant ${JOUR_HEURE.format(avant)}`;
  return { texte, classe: h <= 24 ? "bad" : "warn" };
}

function Liste({ taches, aujourdhui, avocat, urgent }: { taches: Tache[]; aujourdhui: string; avocat: boolean; urgent?: boolean }) {
  return (
    <ul className={`tb-l${urgent ? " tb-urg" : ""}`}>
      {taches.map((t, i) => {
        const q = quand(t, aujourdhui);
        return (
          <li key={`${t.ref}-${t.libelle}-${i}`}>
            <Link href={dossier(t.ref, t.onglet)}>
              <span className="tb-quoi">
                {t.libelle}
                {avocat && <span className="tb-av">{t.avocat ?? "sans avocat"}</span>}
              </span>
              <span className="tb-ref">
                {t.ref} · {t.client} · {proc(t.procedure)}
              </span>
            </Link>
            <span className={`pill ${q.classe}`}>{q.texte}</span>
          </li>
        );
      })}
    </ul>
  );
}

type Nouveau = { ref: string; client: string; procedure: string; urgence: boolean; avant: Date | null; avocat: string | null };

function Nouveaux({ liste, cabinet }: { liste: Nouveau[]; cabinet: boolean }) {
  if (!liste.length) return null;
  const n = liste.length;
  return (
    <section className="tb-nouv" aria-label="Nouveaux dossiers">
      <div className="tb-nouv-t">
        <span className="tb-nouv-n">{n}</span>
        <div>
          <h2>{cabinet ? `Nouveau${n > 1 ? "x" : ""} dossier${n > 1 ? "s" : ""} du cabinet` : `Nouveau${n > 1 ? "x" : ""} dossier${n > 1 ? "s" : ""} à accepter`}</h2>
          <p>{cabinet ? "En attente d'acceptation par l'avocat désigné." : "Payés par le client. À accepter avant l'heure indiquée."}</p>
        </div>
      </div>
      <div className="tb-nouv-l">
        {liste.map((x) => {
          const a = avantLe(x.avant);
          return (
            <Link key={x.ref} className="tb-nd" href={dossier(x.ref)}>
              <div>
                <b>{x.ref}</b>
                <span>
                  {x.client} · {proc(x.procedure)}
                </span>
                {x.urgence && <span className="pill ok">urgence payée</span>}
                {cabinet && <span className="tb-av">{x.avocat ?? "sans avocat"}</span>}
              </div>
              <div>
                <span className={`pill ${a.classe}`}>{a.texte}</span>
                {!cabinet && <span className="tb-btn">Ouvrir et accepter</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Bloc({ titre, compte, classe, pied, children }: { titre: string; compte?: React.ReactNode; classe?: string; pied?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={`tb-w ${classe ?? ""}`}>
      <div className="tb-w-t">
        <h2>{titre}</h2>
        {compte}
      </div>
      <div className="tb-w-c">{children}</div>
      {pied && <div className="tb-w-p">{pied}</div>}
    </section>
  );
}

async function VueSecretariat({ m }: { m: Membre }) {
  const d = await db();
  const s = await tableauSecretariat(d);
  return (
    <div className="tb">
      <header className="tb-tete">
        <div>
          <h1>Bonjour {m.prenom}</h1>
          <p>
            {JOURS.format(new Date())} · {s.aDeposer.length} dépôt{s.aDeposer.length > 1 ? "s" : ""} en attente
          </p>
        </div>
      </header>
      <Bloc titre="À déposer" classe={s.aDeposer.length ? "tb-rouge" : ""} compte={<span className="tb-n">{s.aDeposer.length}</span>}>
        <p className="note">Actes signés et transmis par l&apos;avocat, classés par date limite.</p>
        {s.aDeposer.length ? (
          <ul className="tb-l">
            {s.aDeposer.map((x) => {
              const j = x.dateLimite ? ecart(x.dateLimite, s.aujourdhui) : null;
              const classe = j == null ? "n" : j <= 1 ? "bad" : j <= 7 ? "warn" : "n";
              const texte = !x.dateLimite ? "date limite à vérifier" : j! < 0 ? `en retard (${frDate(x.dateLimite)})` : j === 0 ? "date limite aujourd'hui" : j === 1 ? "date limite demain" : frDate(x.dateLimite);
              return (
                <li key={x.ref}>
                  <Link href={dossier(x.ref)}>
                    <span className="tb-quoi">
                      {x.ref} · {x.client} · {proc(x.procedure)}
                      {x.avocat && <span className="tb-av">{x.avocat}</span>}
                    </span>
                    <span className="tb-ref">
                      {x.tribunal ?? "Juridiction à vérifier"}
                      {x.transmisLe ? ` · transmis le ${frDate(jourParis(x.transmisLe))}` : ""}
                    </span>
                  </Link>
                  <span className={`pill ${classe}`}>{texte}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="vide">Aucun dépôt en attente.</p>
        )}
      </Bloc>
      <div className="tb-deux">
        <Bloc titre="Pièces à relancer" compte={<span className="tb-n">{s.relances.length}</span>}>
          {s.relances.length ? (
            <ul className="tb-l">
              {s.relances.map((x) => (
                <li key={x.ref}>
                  <Link href={dossier(x.ref, "pieces")}>
                    <span className="tb-quoi">
                      {x.client} · {x.n > 1 ? `${x.n} pièces manquantes` : "une pièce manquante"}
                    </span>
                    <span className="tb-ref">
                      {x.ref}
                      {x.dateLimite ? ` · date limite ${frDate(x.dateLimite)}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="vide">Aucune pièce manquante.</p>
          )}
        </Bloc>
        <Bloc titre="Audiences à venir" compte={<span className="tb-n">{s.audiences.length}</span>} pied={<Link href="/avocat/agenda">Agenda complet →</Link>}>
          {s.audiences.length ? (
            s.audiences.map((a, i) => (
              <Link key={`${a.ref}-${i}`} className="tb-rdv" href={dossier(a.ref, "dossier")}>
                <b>{frDate(a.date)}</b>
                <span>
                  {a.tribunal ?? "Tribunal"} · {a.ref}
                  {a.avocat && <span className="tb-ref"> · {a.avocat}</span>}
                </span>
              </Link>
            ))
          ) : (
            <p className="vide">Aucune audience fixée.</p>
          )}
        </Bloc>
      </div>
    </div>
  );
}

export default async function TableauDeBord({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const vue = (await searchParams).vue;
  return (
    <Cadre actif="journee">
      {async (m) => {
        if (m.role === "SECRETARIAT") return <VueSecretariat m={m} />;
        const d = await db();
        const t = await tableauDeBord(d, m, vue === "cabinet");
        const par = (n: Niveau) => t.taches.filter((x) => x.niveau === n);
        const urgent = par("URGENT");
        const semaine = par("SEMAINE");
        const suivi = par("SUIVI");
        const peutCabinet = voitTout(m);
        const associe = m.role === "ASSOCIE";
        const nAlertes = t.alertes ? t.alertes.sansAvocat.length + t.alertes.pendantAbsence.length : 0;
        return (
          <div className="tb">
            <header className="tb-tete">
              <div>
                <h1>Bonjour Maître {m.nom}</h1>
                <p>
                  {JOURS.format(new Date())} · {t.enCours} dossier{t.enCours > 1 ? "s" : ""} en cours{t.cabinet ? " au cabinet" : ""}
                </p>
              </div>
              {peutCabinet && (
                <nav className="tb-vue" aria-label="Périmètre">
                  <Link href="/avocat" className={!t.cabinet ? "on" : ""}>
                    Mes dossiers
                  </Link>
                  <Link href="/avocat?vue=cabinet" className={t.cabinet ? "on" : ""}>
                    Vision du cabinet
                  </Link>
                </nav>
              )}
            </header>

            {t.cabinet && t.alertes && nAlertes > 0 && (
              <section className="tb-alerte">
                <h2>
                  À régler{associe ? " par un associé" : ""} · {nAlertes}
                </h2>
                <ul className="tb-l">
                  {t.alertes.pendantAbsence.map((a) => (
                    <li key={`abs-${a.ref}-${a.libelle}-${a.date}`}>
                      <Link href={dossier(a.ref)}>
                        <span className="tb-quoi">
                          {a.libelle} pendant l&apos;absence de l&apos;avocat <span className="tb-av">{a.avocat}</span>
                        </span>
                        <span className="tb-ref">
                          {a.ref} · {a.client} · {proc(a.procedure)} · {(MOTIFS_ABSENCE[a.absence.motif] ?? "absence").toLowerCase()} du {frDate(a.absence.debut)} au {frDate(a.absence.fin)} · échéance le {frDate(a.date)}
                        </span>
                      </Link>
                      <Link className="tb-btn" href={dossier(a.ref)}>
                        {associe ? "Réattribuer" : "Ouvrir"}
                      </Link>
                    </li>
                  ))}
                  {t.alertes.sansAvocat.map((a) => (
                    <li key={`sa-${a.ref}`}>
                      <Link href={dossier(a.ref)}>
                        <span className="tb-quoi">Dossier payé sans avocat disponible</span>
                        <span className="tb-ref">
                          {a.ref} · {a.client} · {proc(a.procedure)} · reçu le {frDate(jourParis(a.recuLe))} à {HEURE.format(a.recuLe)}
                        </span>
                      </Link>
                      <Link className="tb-btn" href={dossier(a.ref)}>
                        {associe ? "Attribuer" : "Ouvrir"}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Nouveaux liste={t.nouveaux} cabinet={t.cabinet} />

            {t.cabinet ? (
              <div className="tb-deux">
                <Bloc titre="Urgences du cabinet" classe={urgent.length ? "tb-rouge" : ""} compte={<span className={`pill ${urgent.length ? "bad" : "ok"}`}>{urgent.length || "aucune"}</span>}>
                  <p className="note">Échéances dépassées, du jour ou du lendemain, tous avocats confondus.</p>
                  {urgent.length ? <Liste taches={urgent} aujourdhui={t.aujourdhui} avocat urgent /> : <p className="vide">Rien d&apos;urgent au cabinet.</p>}
                  {semaine.length > 0 && (
                    <details className="tb-plus">
                      <summary>
                        <h3>Cette semaine · {semaine.length}</h3>
                      </summary>
                      <Liste taches={semaine} aujourdhui={t.aujourdhui} avocat />
                    </details>
                  )}
                </Bloc>
                <Bloc titre="L'équipe" compte={<span className="tb-n">{t.enCours}</span>} pied={associe ? <Link href="/avocat/indicateurs">Indicateurs →</Link> : undefined}>
                  <div className="tb-scroll">
                    <table className="tb-tbl">
                      <thead>
                        <tr>
                          <th>Avocat</th>
                          <th>Dossiers</th>
                          <th>Urgent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(t.equipe ?? []).map((u) => (
                          <tr key={u.nom ?? ""}>
                            <td>
                              {u.nom}
                              {u.absence && (
                                <>
                                  <br />
                                  <span className="pill warn">
                                    {(MOTIFS_ABSENCE[u.absence.motif] ?? "absent").toLowerCase()} {u.absence.debut === u.absence.fin ? `le ${frDate(u.absence.debut)}` : `du ${frDate(u.absence.debut)} au ${frDate(u.absence.fin)}`}
                                  </span>
                                </>
                              )}
                            </td>
                            <td>{u.dossiers}</td>
                            <td>{u.urgent ? <span className="pill bad">{u.urgent}</span> : 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Bloc>
              </div>
            ) : (
              <div className="tb-deux">
                <Bloc titre="Ma journée" classe={urgent.length ? "tb-rouge" : ""} compte={<span className={`pill ${urgent.length ? "bad" : "ok"}`}>{urgent.length ? `${urgent.length} urgente${urgent.length > 1 ? "s" : ""}` : "rien d'urgent"}</span>}>
                  <h3 className="tb-niv r">À traiter maintenant</h3>
                  {urgent.length ? <Liste taches={urgent} aujourdhui={t.aujourdhui} avocat={false} urgent /> : <p className="vide">Aucune échéance dans les 48 heures.</p>}
                  <h3 className="tb-niv">Cette semaine</h3>
                  {semaine.length ? <Liste taches={semaine} aujourdhui={t.aujourdhui} avocat={false} /> : <p className="vide">Rien d&apos;autre cette semaine.</p>}
                  {suivi.length > 0 && (
                    <details className="tb-plus">
                      <summary>
                        <h3 className="tb-niv">À suivre · {suivi.length}</h3>
                      </summary>
                      <Liste taches={suivi} aujourdhui={t.aujourdhui} avocat={false} />
                    </details>
                  )}
                </Bloc>
                <Bloc titre="Rendez-vous du jour" pied={<Link href="/avocat/agenda">Agenda complet →</Link>}>
                  {t.rdv.length ? (
                    t.rdv.map((r) => (
                      <Link key={r.ref} className="tb-rdv" href={dossier(r.ref)}>
                        <b>{HEURE.format(r.debut)}</b>
                        <span>
                          Consultation en visio
                          <br />
                          <span className="tb-ref">
                            {r.ref} · {r.client}
                          </span>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p className="vide">Aucun rendez-vous aujourd&apos;hui.</p>
                  )}
                </Bloc>
              </div>
            )}
          </div>
        );
      }}
    </Cadre>
  );
}
