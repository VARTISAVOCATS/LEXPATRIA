// Lot 3 : questions des clients en attente de réponse (dernier message venant du client).
import Link from "next/link";
import { db } from "@/db";
import { PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { questionsEnAttente } from "@/lib/serveur/agenda";
import { frDateHeure } from "@/lib/statuts";
import { Cadre } from "../cadre";
import { Reponse } from "./Reponse";

export const metadata = { title: "Questions des clients — Espace cabinet", robots: { index: false } };
const proc = (p: string) => PROCEDURES[p as CodeProcedure]?.libelle ?? p;

export default function Questions() {
  return (
    <Cadre actif="questions">
      {async (m) => {
        const q = await questionsEnAttente(await db(), m);
        return (
          <>
            <p className="note">
              Les dossiers dont le dernier message vient du client, du plus ancien au plus récent. L&apos;assistant peut proposer une réponse ; elle n&apos;est envoyée qu&apos;après votre
              validation. Le client est prévenu par e-mail, sans le contenu du message.
            </p>
            {q.length === 0 && (
              <section className="card">
                <p className="vide">Aucune question en attente.</p>
              </section>
            )}
            <div className="cab-deux">
              {q.map(({ dos, cli, dernier }) => {
                const heures = Math.round((Date.now() - dernier.le.getTime()) / 3_600_000);
                return (
                  <section className="card" key={dos.id}>
                    <div className="cab-barre">
                      <Link href={`/avocat/dossiers/${dos.reference}?onglet=echanges`}>
                        <b>{dos.reference}</b> · {cli.prenom} {cli.nom} · {proc(dos.procedure)}
                      </Link>
                      <span className={`pill ${heures >= 24 ? "bad" : heures >= 8 ? "warn" : "n"}`}>reçu le {frDateHeure(dernier.le)}</span>
                    </div>
                    <blockquote className="qr-msg">{dernier.contenu.length > 600 ? `${dernier.contenu.slice(0, 600)}…` : dernier.contenu}</blockquote>
                    <Reponse reference={dos.reference} />
                  </section>
                );
              })}
            </div>
          </>
        );
      }}
    </Cadre>
  );
}
