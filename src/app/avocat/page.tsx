// Lot 3 : « Ma journée » — dossiers à accepter, dates limites à vérifier, échéances, messages des clients.
import Link from "next/link";
import { db } from "@/db";
import { PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { journee } from "@/lib/serveur/cabinet";
import { compteurs } from "@/lib/serveur/dossiers";
import { frDate, frDateHeure } from "@/lib/statuts";
import { Cadre } from "./cadre";

export const metadata = { title: "Espace cabinet — LEXPATRIA", robots: { index: false } };

const LIB_ECH: Record<string, string> = {
  DATE_LIMITE: "Date limite du recours",
  MEMOIRE_COMPLEMENTAIRE: "Mémoire complémentaire",
  AUDIENCE: "Audience",
  CLOTURE: "Clôture de l'instruction",
  APPEL: "Date limite d'appel",
  REPONSE_MOTIFS: "Réponse de l'administration",
};
const proc = (p: string) => PROCEDURES[p as CodeProcedure]?.libelle ?? p;

export default function MaJournee() {
  return (
    <Cadre actif="journee">
      {async (m) => {
        const d = await db();
        const [j, c] = await Promise.all([journee(d, m), compteurs(d, m)]);
        return (
          <div className="cab-grille">
            <section className="cab-kpi">
              <Link href="/avocat/dossiers?filtre=a_prendre" className="kpi">
                <b>{c.aPrendre}</b>
                <span>À prendre en charge</span>
              </Link>
              <Link href="/avocat/dossiers?filtre=en_cours" className="kpi">
                <b>{c.enCours}</b>
                <span>En cours</span>
              </Link>
              <Link href="/avocat/dossiers?filtre=termines" className="kpi">
                <b>{c.termines}</b>
                <span>Terminés</span>
              </Link>
            </section>

            <section className="card">
              <h2>Dossiers à accepter</h2>
              {j.aAccepter.length === 0 ? (
                <p className="vide">Aucun dossier en attente.</p>
              ) : (
                <ul className="esp-lignes">
                  {j.aAccepter.map(({ dos, cli }) => {
                    const retard = dos.acceptationAvant && dos.acceptationAvant < new Date();
                    return (
                      <li key={dos.id}>
                        <Link href={`/avocat/dossiers/${dos.reference}`}>
                          <b>{dos.reference}</b> · {cli.prenom} {cli.nom} · {proc(dos.procedure)}
                        </Link>
                        <span className={`pill ${retard ? "bad" : dos.traitement === "URGENCE" ? "warn" : "n"}`}>
                          {dos.traitement === "URGENCE" ? "Urgent · " : ""}
                          {dos.acceptationAvant ? `à accepter avant ${frDateHeure(dos.acceptationAvant)}` : "à accepter"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="card">
              <h2>Dates limites à vérifier</h2>
              <p className="note">Une date limite estimée ne vaut pas date vérifiée : aucun dépôt avant vérification.</p>
              {j.nonVerifiees.length === 0 ? (
                <p className="vide">Toutes les dates limites de vos dossiers en cours sont vérifiées.</p>
              ) : (
                <ul className="esp-lignes">
                  {j.nonVerifiees.map((x) => (
                    <li key={x.ref}>
                      <Link href={`/avocat/dossiers/${x.ref}`}>
                        <b>{x.ref}</b> · {proc(x.procedure)}
                      </Link>
                      <span className="pill warn">estimée au {frDate(x.dateLimite)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2>Échéances des 14 prochains jours</h2>
              {j.prochaines.length === 0 ? (
                <p className="vide">Aucune échéance.</p>
              ) : (
                <ul className="esp-lignes">
                  {j.prochaines.map(({ e, ref, procedure }) => (
                    <li key={e.id}>
                      <Link href={`/avocat/dossiers/${ref}`}>
                        <b>{ref}</b> · {LIB_ECH[e.type] ?? e.type} · {proc(procedure)}
                      </Link>
                      <span className={`pill ${e.date <= j.aujourdhui ? "bad" : "n"}`}>{frDate(e.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2>Messages des clients</h2>
              {j.messagesClients.length === 0 ? (
                <p className="vide">Aucun message non lu.</p>
              ) : (
                <ul className="esp-lignes">
                  {j.messagesClients.map((x) => (
                    <li key={x.ref}>
                      <Link href={`/avocat/dossiers/${x.ref}?onglet=echanges`}>
                        <b>{x.ref}</b>
                      </Link>
                      <span className="pill ai">{Number(x.n)} non lu(s)</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        );
      }}
    </Cadre>
  );
}
