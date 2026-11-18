// « Ma journée » : une seule liste de ce qui est à faire, classée par urgence.
// Aucune échéance manquée sans noyer l'avocat : l'urgent en tête, la semaine ensuite, le reste replié.
import Link from "next/link";
import { db } from "@/db";
import { PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { tachesDuJour } from "@/lib/serveur/cabinet";
import { frDate } from "@/lib/statuts";
import type { Niveau, Tache } from "@/lib/taches";
import { Cadre } from "./cadre";

export const metadata = { title: "Espace cabinet — LEXPATRIA", robots: { index: false } };

const proc = (p: string) => PROCEDURES[p as CodeProcedure]?.libelle ?? p;
const JOURS = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });

function quand(t: Tache, aujourdhui: string): { texte: string; classe: string } {
  if (!t.echeance) return { texte: "à faire", classe: "n" };
  const j = Math.round((new Date(`${t.echeance}T12:00:00Z`).getTime() - new Date(`${aujourdhui}T12:00:00Z`).getTime()) / 86_400_000);
  const heure = t.heure ? ` à ${t.heure.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}` : "";
  if (j < 0) return { texte: `en retard (${frDate(t.echeance)})`, classe: "bad" };
  if (j === 0) return { texte: `aujourd'hui${heure}`, classe: "bad" };
  if (j === 1) return { texte: `demain${heure}`, classe: "warn" };
  return { texte: `${frDate(t.echeance)} · dans ${j} jours`, classe: j <= 7 ? "warn" : "n" };
}

function Liste({ taches, aujourdhui, cabinet }: { taches: Tache[]; aujourdhui: string; cabinet: boolean }) {
  return (
    <ul className="mj-liste">
      {taches.map((t, i) => {
        const q = quand(t, aujourdhui);
        return (
          <li key={`${t.ref}-${t.libelle}-${i}`}>
            <Link href={`/avocat/dossiers/${t.ref}?onglet=${t.onglet}`}>
              <span className="mj-quoi">{t.libelle}</span>
              <span className="mj-qui">
                {t.ref} · {t.client} · {proc(t.procedure)}
                {cabinet && t.avocat ? ` · ${t.avocat}` : ""}
              </span>
            </Link>
            <span className={`pill ${q.classe}`}>{q.texte}</span>
          </li>
        );
      })}
    </ul>
  );
}

const TITRES: Record<Niveau, [string, string]> = {
  URGENT: ["À traiter maintenant", "Échéance dépassée, aujourd'hui ou demain, et dossiers payés en urgence."],
  SEMAINE: ["Cette semaine", "Échéances des sept prochains jours et suites à donner."],
  SUIVI: ["À suivre", "Plus lointain : rien ne presse, rien n'est oublié."],
};

export default async function MaJournee({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const vueCabinet = (await searchParams).vue === "cabinet";
  return (
    <Cadre actif="journee">
      {async (m) => {
        const d = await db();
        const { taches, enCours, tout } = await tachesDuJour(d, m, vueCabinet);
        const aujourdhui = new Date().toISOString().slice(0, 10);
        const par = (n: Niveau) => taches.filter((t) => t.niveau === n);
        const urgent = par("URGENT");
        const semaine = par("SEMAINE");
        const suivi = par("SUIVI");
        const salut = m.role === "SECRETARIAT" ? `Bonjour ${m.prenom}` : `Bonjour Maître ${m.nom}`;
        return (
          <div className="mj">
            <header className="mj-tete">
              <div>
                <h1>{salut}</h1>
                <p>
                  {JOURS.format(new Date())} · {enCours} dossier{enCours > 1 ? "s" : ""} en cours{tout ? " au cabinet" : ""}
                </p>
              </div>
              {m.role === "ASSOCIE" && (
                <nav className="mj-vue" aria-label="Périmètre">
                  <Link href="/avocat" className={!vueCabinet ? "on" : ""}>
                    Mes dossiers
                  </Link>
                  <Link href="/avocat?vue=cabinet" className={vueCabinet ? "on" : ""}>
                    Tout le cabinet
                  </Link>
                </nav>
              )}
            </header>

            <section className={`card mj-bloc ${urgent.length ? "mj-urgent" : ""}`}>
              <h2>
                {TITRES.URGENT[0]} <span className={`pill ${urgent.length ? "bad" : "ok"}`}>{urgent.length || "rien"}</span>
              </h2>
              {urgent.length ? <Liste taches={urgent} aujourdhui={aujourdhui} cabinet={tout} /> : <p className="vide">Rien d&apos;urgent. Aucune échéance dans les 48 heures.</p>}
            </section>

            <section className="card mj-bloc">
              <h2>
                {TITRES.SEMAINE[0]} <span className="pill n">{semaine.length}</span>
              </h2>
              <p className="note">{TITRES.SEMAINE[1]}</p>
              {semaine.length ? <Liste taches={semaine} aujourdhui={aujourdhui} cabinet={tout} /> : <p className="vide">Rien d&apos;autre cette semaine.</p>}
            </section>

            {suivi.length > 0 && (
              <details className="card mj-bloc mj-suivi">
                <summary>
                  <h2>
                    {TITRES.SUIVI[0]} <span className="pill n">{suivi.length}</span>
                  </h2>
                </summary>
                <p className="note">{TITRES.SUIVI[1]}</p>
                <Liste taches={suivi} aujourdhui={aujourdhui} cabinet={tout} />
              </details>
            )}
          </div>
        );
      }}
    </Cadre>
  );
}
