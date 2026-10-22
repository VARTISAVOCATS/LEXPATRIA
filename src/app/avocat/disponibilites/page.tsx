// Lot 3 : absences et ouverture à l'attribution automatique.
import { db } from "@/db";
import { disponibilites, equipe } from "@/lib/serveur/cabinet";
import { frDateHeure } from "@/lib/statuts";
import { ActionForm } from "../Actions";
import { Cadre } from "../cadre";

export const metadata = { title: "Disponibilités — Espace cabinet", robots: { index: false } };

export default function Disponibilites() {
  return (
    <Cadre actif="disponibilites">
      {async (m) => {
        const d = await db();
        const membres = (m.role === "ASSOCIE" ? await equipe(d) : [m]).filter((u) => u.actif && (u.role === "AVOCAT" || u.role === "ASSOCIE"));
        const absences = await Promise.all(membres.map((u) => disponibilites(d, u.id)));
        return (
          <>
            <p className="note">
              Pendant une absence, aucun dossier ne vous est attribué automatiquement. Les associés gèrent les absences de toute l&apos;équipe.
            </p>
            <div className="cab-deux">
              {membres.map((u, i) => (
                <section className="card" key={u.id}>
                  <h2>
                    Me {u.prenom} {u.nom}
                  </h2>
                  <div className="esp-etat">
                    <span className={`pill ${u.attributionOuverte ? "ok" : "warn"}`}>{u.attributionOuverte ? "Reçoit de nouveaux dossiers" : "Attribution suspendue"}</span>
                    <ActionForm
                      api="/api/avocat/disponibilites"
                      base={{ action: "attribution", avocatId: u.id, ouverte: !u.attributionOuverte }}
                      libelle={u.attributionOuverte ? "Suspendre l'attribution" : "Rouvrir l'attribution"}
                      classe="btn sm ghost"
                    />
                  </div>
                  <ul className="esp-lignes">
                    {absences[i].map((a) => (
                      <li key={a.id}>
                        <span>
                          Du {frDateHeure(a.debut).split(" ")[0]} au {frDateHeure(a.fin).split(" ")[0]}
                        </span>
                        <ActionForm api="/api/avocat/disponibilites" base={{ action: "supprimer", id: a.id }} libelle="Supprimer" classe="btn sm ghost" />
                      </li>
                    ))}
                    {absences[i].length === 0 && <li className="vide">Aucune absence prévue.</li>}
                  </ul>
                  <ActionForm
                    api="/api/avocat/disponibilites"
                    base={{ action: "ajouter", avocatId: u.id }}
                    champs={[
                      { nom: "debut", type: "date", label: "Du" },
                      { nom: "fin", type: "date", label: "Au" },
                    ]}
                    libelle="Ajouter l'absence"
                  />
                </section>
              ))}
            </div>
          </>
        );
      }}
    </Cadre>
  );
}
