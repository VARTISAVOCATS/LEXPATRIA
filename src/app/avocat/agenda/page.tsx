// Lot 3 : agenda du cabinet — échéances, acceptations et avis à rendre ; absences de l'équipe.
import Link from "next/link";
import { db } from "@/db";
import { PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { absencesEquipe, agenda, type ElementAgenda } from "@/lib/serveur/agenda";
import { equipe, MOTIFS_ABSENCE } from "@/lib/serveur/cabinet";
import { frDate, frDateHeure } from "@/lib/statuts";
import { ActionForm } from "../Actions";
import { Cadre } from "../cadre";

export const metadata = { title: "Agenda — Espace cabinet", robots: { index: false } };

const proc = (p: string) => PROCEDURES[p as CodeProcedure]?.libelle ?? p;
const GENRE: Record<ElementAgenda["genre"], string> = { ECHEANCE: "Échéance", ACCEPTATION: "Acceptation", AVIS: "Consultation", RDV: "Visio" };

function Groupe({ titre, elements, ton, vide, tous }: { titre: string; elements: ElementAgenda[]; ton: string; vide: string; tous: boolean }) {
  return (
    <section className="card">
      <h2>
        {titre} <span className={`pill ${elements.length ? ton : "n"}`}>{elements.length}</span>
      </h2>
      {elements.length === 0 ? (
        <p className="vide">{vide}</p>
      ) : (
        <ul className="esp-lignes">
          {elements.map((e) => (
            <li key={e.cle}>
              <Link href={`/avocat/dossiers/${e.reference}${e.genre === "AVIS" ? "?onglet=travail" : ""}`}>
                <b>{e.reference}</b> · {e.libelle} · {proc(e.procedure)}
                {tous && e.avocat ? ` · Me ${e.avocat}` : ""}
              </Link>
              <span className="cab-actions">
                <span className={`pill ${ton}`}>
                  {GENRE[e.genre]} · {e.heure ? frDateHeure(e.heure) : frDate(e.jour)}
                </span>
                {e.echeanceId && <ActionForm base={{ reference: e.reference, action: "echeanceFaite", id: e.echeanceId }} libelle="Faite" classe="btn sm ghost" />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Agenda() {
  return (
    <Cadre actif="agenda">
      {async (m) => {
        const d = await db();
        const tous = m.role === "ASSOCIE" || m.role === "SECRETARIAT";
        const [a, absences, membres] = await Promise.all([agenda(d, m), absencesEquipe(d, m), m.role === "ASSOCIE" ? equipe(d) : Promise.resolve([])]);
        const avocats = (m.role === "ASSOCIE" ? membres : [m]).filter((u) => u.actif && (u.role === "AVOCAT" || u.role === "ASSOCIE"));
        return (
          <div className="cab-deux">
            <Groupe titre="En retard" elements={a.retard} ton="bad" vide="Rien en retard." tous={tous} />
            <Groupe titre="Dans les 7 prochains jours" elements={a.semaine} ton="warn" vide="Aucune échéance cette semaine." tous={tous} />
            <div className="cab-large">
              <Groupe titre="Plus tard (60 jours)" elements={a.plusTard} ton="n" vide="Aucune échéance plus lointaine." tous={tous} />
            </div>

            <section className="card cab-large" id="absences">
              <h2>Absences</h2>
              <p className="note">
                Aucun dossier n&apos;est attribué automatiquement pendant une absence, ni dans les 2 jours ouvrés qui la précèdent. Les rappels d&apos;échéance sont envoyés par e-mail à
                l&apos;avocat la veille et le jour même.
              </p>
              <ul className="esp-lignes">
                {absences.map(({ a: x, prenom, nom }) => (
                  <li key={x.id}>
                    <span>
                      Me {prenom} {nom} · {MOTIFS_ABSENCE[x.motif] ?? x.motif} · du {frDateHeure(x.debut).split(" ")[0]} au {frDateHeure(x.fin).split(" ")[0]}
                    </span>
                    {(m.role === "ASSOCIE" || x.avocatId === m.id) && (
                      <ActionForm api="/api/avocat/disponibilites" base={{ action: "supprimer", id: x.id }} libelle="Supprimer" classe="btn sm ghost" />
                    )}
                  </li>
                ))}
                {absences.length === 0 && <li className="vide">Aucune absence prévue.</li>}
              </ul>
              {avocats.length > 0 && (
                <ActionForm
                  api="/api/avocat/disponibilites"
                  base={{ action: "ajouter" }}
                  champs={[
                    ...(avocats.length > 1 ? [{ nom: "avocatId", type: "select" as const, label: "Avocat", options: avocats.map((u) => [u.id, `Me ${u.prenom} ${u.nom}`] as [string, string]), defaut: avocats[0].id }] : []),
                    { nom: "motif", type: "select" as const, label: "Motif", options: Object.entries(MOTIFS_ABSENCE), defaut: "CONGES" },
                    { nom: "debut", type: "date" as const, label: "Du" },
                    { nom: "fin", type: "date" as const, label: "Au" },
                  ]}
                  libelle="Ajouter l'absence"
                />
              )}
              <p className="note">
                L&apos;ouverture ou la suspension de l&apos;attribution automatique se règle dans <Link href="/avocat/disponibilites">Disponibilités</Link>.
              </p>
            </section>
          </div>
        );
      }}
    </Cadre>
  );
}
