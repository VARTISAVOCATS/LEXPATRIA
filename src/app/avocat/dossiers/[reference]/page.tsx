// Lot 3 : fiche dossier de l'espace cabinet.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { formatEuros, PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { appelDe, premiereInstance } from "@/lib/serveur/appel";
import { equipe, journalDossier, TYPES_ECHEANCE } from "@/lib/serveur/cabinet";
import { accesEquipe, detailDossier, marquerLus } from "@/lib/serveur/dossiers";
import type { FichierStocke } from "@/lib/serveur/stockage";
import { frDate, frDateHeure, LIBELLES_STATUT, peutFaireAppel, STATUTS_AVOCAT, type Statut } from "@/lib/statuts";
import { FormMessage, FormPiece } from "../../../espace/[reference]/Formulaires";
import { ActionForm } from "../../Actions";
import { Cadre } from "../../cadre";
import { donneesPoste } from "./donnees-poste";
import PosteTravail from "./PosteTravail";

export const metadata = { title: "Dossier — Espace cabinet", robots: { index: false } };

const ONGLETS = [
  ["travail", "Poste de travail"],
  ["dossier", "Dossier"],
  ["echanges", "Échanges"],
  ["pieces", "Pièces"],
  ["echeances", "Échéances"],
  ["documents", "Convention et paiements"],
  ["journal", "Journal"],
] as const;

const LIB_QUALIF: Record<string, string> = {
  question: "Question posée par le client",
  visaType: "Type de visa",
  dateDemande: "Date de la demande",
  dateEcheance: "Échéance indiquée",
  emploiMenace: "Emploi menacé",
  naturalisationIssue: "Issue de la demande de naturalisation",
  silenceApresRecoursPrealable: "Silence après un recours préalable",
};
const valeurLisible = (v: unknown) =>
  typeof v === "boolean" ? (v ? "Oui" : "Non") : typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join("/") : typeof v === "string" ? v : JSON.stringify(v);

const LIB_ECH: Record<string, string> = {
  DATE_LIMITE: "Date limite du recours",
  MEMOIRE_COMPLEMENTAIRE: "Mémoire complémentaire",
  AUDIENCE: "Audience",
  CLOTURE: "Clôture de l'instruction",
  APPEL: "Date limite d'appel",
  REPONSE_MOTIFS: "Réponse de l'administration",
};

function Valeur({ l, v }: { l: string; v?: string | null }) {
  if (!v) return null;
  return (
    <div className="kv">
      <span>{l}</span>
      <b>{v}</b>
    </div>
  );
}

export default async function FicheDossier({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ onglet?: string }> }) {
  const { reference } = await params;
  const { onglet: o } = await searchParams;
  const onglet = ONGLETS.find(([k]) => k === o)?.[0] ?? "travail";
  return (
    <Cadre actif="dossiers">
      {async (m) => {
        const d = await db();
        const dos = await accesEquipe(d, m, reference);
        if (!dos) notFound();
        if (onglet === "echanges") await marquerLus(d, dos.id, "EQUIPE");
        const x = await detailDossier(d, dos);
        const membres = m.role === "ASSOCIE" ? (await equipe(d)).filter((u) => u.actif && (u.role === "AVOCAT" || u.role === "ASSOCIE")) : [];
        const lignes = onglet === "journal" ? await journalDossier(d, dos.id) : [];
        const noms = onglet === "journal" ? new Map((await equipe(d)).map((u) => [u.id, `${u.prenom} ${u.nom}`])) : new Map<string, string>();
        const statut = dos.statut as Statut;
        const estAvocat = m.role === "ASSOCIE" || m.role === "AVOCAT";
        const qualif = (dos.qualification ?? {}) as Record<string, unknown>;
        const faits = (dos.faitsExtraits ?? []) as unknown[];
        const nonLus = x.messages.filter((y) => y.auteur === "CLIENT" && !y.luLe).length;
        const ref = dos.reference;
        const poste = onglet === "travail" ? await donneesPoste(d, dos, m) : null;
        const [parent, appel] = await Promise.all([premiereInstance(d, dos), dos.dossierParentId ? Promise.resolve(null) : appelDe(d, dos.id)]);
        const peutProposerAppel =
          !parent && !appel && !dos.avisPrealable && peutFaireAppel(dos.procedure) && (statut === "JUGE" || statut === "CLOS") && (m.role === "ASSOCIE" || dos.avocatId === m.id);

        return (
          <>
            <p className="fil-ariane">
              <Link href="/avocat/dossiers">Dossiers</Link> › {ref}
            </p>
            <section className="card esp-tete">
              <span className="esp-ref">
                Dossier {ref} · déposé le {frDateHeure(dos.creeLe)} {dos.source ? `· source ${dos.source}` : ""}
              </span>
              <h1>
                {x.cli.civilite === "MADAME" ? "Mme" : "M."} {x.cli.prenom} {x.cli.nom} — {PROCEDURES[dos.procedure as CodeProcedure]?.libelle ?? dos.procedure}
              </h1>
              <div className="esp-etat">
                <span className={`pill ${statut === "PAYE" ? "warn" : "ok"}`}>{LIBELLES_STATUT[statut]}</span>
                {dos.traitement === "URGENCE" && <span className="pill bad">Urgence</span>}
                {x.cli.algerien && <span className="pill warn">Accord franco-algérien</span>}
                <span>{x.avocat ? `Me ${x.avocat.prenom} ${x.avocat.nom}` : "Non attribué"}</span>
                {statut === "PAYE" && dos.acceptationAvant && <span className="pill warn">à accepter avant {frDateHeure(dos.acceptationAvant)}</span>}
                {parent && (
                  <Link className="pill ai" href={`/avocat/dossiers/${parent.reference}`}>
                    Appel du dossier {parent.reference}
                    {dos.cour ? ` · CAA de ${dos.cour}` : ""}
                  </Link>
                )}
                {appel && (
                  <Link className="pill ai" href={`/avocat/dossiers/${appel.reference}`}>
                    Dossier d&apos;appel {appel.reference} · {LIBELLES_STATUT[appel.statut as Statut]}
                  </Link>
                )}
              </div>
              {statut === "APPEL_PROPOSE" && (
                <p className="note">
                  Appel proposé au client : il accepte l&apos;avenant et règle dans son espace. Le dossier vous revient ensuite à accepter. Date limite d&apos;appel estimée :{" "}
                  {frDate(dos.dateLimite)}.
                </p>
              )}
              <div className="cab-actions">
                {statut === "PAYE" && estAvocat && (m.role === "ASSOCIE" || dos.avocatId === m.id) && (
                  <ActionForm base={{ reference: ref, action: "accepter" }} libelle="Accepter le dossier" classe="btn cta sm" />
                )}
                {statut !== "PAYE" && statut !== "APPEL_PROPOSE" && (
                  <ActionForm
                    base={{ reference: ref, action: "statut" }}
                    champs={[{ nom: "statut", type: "select", label: "Étape", defaut: STATUTS_AVOCAT.includes(statut) ? statut : "EN_REDACTION", options: STATUTS_AVOCAT.map((s) => [s, LIBELLES_STATUT[s]]) }]}
                    libelle="Mettre à jour l'étape"
                  />
                )}
                {m.role === "ASSOCIE" && membres.length > 0 && (
                  <ActionForm
                    base={{ reference: ref, action: "reattribuer" }}
                    champs={[{ nom: "avocatId", type: "select", label: "Avocat", defaut: dos.avocatId ?? membres[0].id, options: membres.map((u) => [u.id, `Me ${u.prenom} ${u.nom}`]) }]}
                    libelle="Réattribuer"
                    classe="btn sm ghost"
                  />
                )}
              </div>
            </section>

            {peutProposerAppel && (
              <section className="card">
                <h2>Proposer l&apos;appel au client</h2>
                <p className="note">
                  Un dossier d&apos;appel est créé et relié à ce dossier. Le client reçoit votre message, puis accepte l&apos;avenant d&apos;appel et règle dans son espace. Délai d&apos;appel
                  estimé : un mois après la notification du jugement en matière d&apos;OQTF, deux mois sinon ; vous le vérifiez ensuite comme pour tout recours.
                </p>
                <ActionForm
                  base={{ reference: ref, action: "proposerAppel" }}
                  enLigne={false}
                  champs={[
                    { nom: "dateJugement", type: "date", label: "Date du jugement" },
                    { nom: "dateNotification", type: "date", label: "Date de notification du jugement" },
                    { nom: "message", type: "textarea", label: "Votre avis au client sur l'opportunité de l'appel" },
                  ]}
                  libelle="Proposer l'appel"
                  classe="btn cta sm"
                  confirmation="Le client recevra votre message et la proposition d'appel."
                />
              </section>
            )}

            <nav className="tabs esp-tabs" aria-label="Rubriques du dossier">
              {ONGLETS.map(([k, l]) => (
                <Link key={k} href={`/avocat/dossiers/${ref}?onglet=${k}`} className={k === onglet ? "on" : ""}>
                  {l}
                  {k === "echanges" && nonLus > 0 && <span className="cnt">{nonLus}</span>}
                </Link>
              ))}
            </nav>

            {onglet === "travail" && poste && <PosteTravail {...poste} />}

            {onglet === "dossier" && (
              <div className="cab-deux">
                <section className="card">
                  <h2>Date limite</h2>
                  {dos.dateLimiteVerifiee ? (
                    <p>
                      <b>{frDate(dos.dateLimite)}</b> <span className="pill ok">vérifiée</span>
                    </p>
                  ) : (
                    <p>
                      Estimée au <b>{dos.dateLimite ? frDate(dos.dateLimite) : "—"}</b> <span className="pill warn">à vérifier</span>
                      <br />
                      <span className="note">Estimation au plus tôt, à partir de la date de notification déclarée ({frDate(dos.dateNotification) || "non indiquée"}).</span>
                    </p>
                  )}
                  {estAvocat && (
                    <ActionForm
                      base={{ reference: ref, action: "dateLimite" }}
                      champs={[{ nom: "date", type: "date", label: "Date limite retenue après vérification", defaut: dos.dateLimite ?? "" }]}
                      libelle={dos.dateLimiteVerifiee ? "Corriger la date" : "Valider la date limite"}
                      confirmation="Vous attestez avoir vérifié la date limite sur les pièces du dossier."
                    />
                  )}
                </section>
                <section className="card">
                  <h2>Client</h2>
                  <Valeur l="Code client" v={x.cli.code} />
                  <Valeur l="E-mail" v={x.cli.email} />
                  <Valeur l="Téléphone" v={x.cli.telephone} />
                  <Valeur l="Langue" v={x.cli.langue} />
                  <Valeur l="Nationalité algérienne" v={x.cli.algerien == null ? null : x.cli.algerien ? "Oui" : "Non"} />
                  <Valeur l="Préfecture" v={dos.prefecture} />
                  <Valeur l="Situation (OQTF)" v={dos.situationOQTF} />
                  <Valeur l="Date de la décision" v={frDate(dos.dateDecision)} />
                  <Valeur l="Date de notification" v={frDate(dos.dateNotification)} />
                </section>
                <section className="card cab-large">
                  <h2>Récit du client</h2>
                  <p className="recit">{dos.recit || "—"}</p>
                  {faits.length > 0 && (
                    <>
                      <h3>Faits confirmés par le client</h3>
                      <ul>
                        {faits.map((f, i) => (
                          <li key={i}>{typeof f === "string" ? f : JSON.stringify(f)}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {Object.values(qualif).some((v) => v !== null && v !== undefined && v !== "") && (
                    <>
                      <h3>Réponses avant paiement</h3>
                      {Object.entries(qualif)
                        .filter(([, v]) => v !== null && v !== undefined && v !== "")
                        .map(([k, v]) => (
                          <Valeur key={k} l={LIB_QUALIF[k] ?? k} v={valeurLisible(v)} />
                        ))}
                    </>
                  )}
                  <p className="note">Les éléments lus par l&apos;IA ne sont jamais réputés vérifiés.</p>
                </section>
              </div>
            )}

            {onglet === "echanges" && (
              <section className="card">
                <h2>Échanges avec le client</h2>
                <div className="fil">
                  {x.messages.length === 0 && <p className="vide">Aucun message.</p>}
                  {x.messages.map((y) => (
                    <div key={y.id} className={`bulle ${y.auteur !== "CLIENT" ? "moi" : ""}`}>
                      <span className="qui">
                        {y.auteur === "CLIENT" ? `${x.cli.prenom} ${x.cli.nom}` : y.auteur === "SECRETARIAT" ? "Secrétariat" : "Avocat"} · {frDateHeure(y.creeLe)}
                        {y.auteur !== "CLIENT" && (y.luLe ? " · lu" : " · non lu")}
                      </span>
                      <p>{y.contenu}</p>
                    </div>
                  ))}
                </div>
                <FormMessage reference={ref} api="/api/avocat/message" />
              </section>
            )}

            {onglet === "pieces" && (
              <section className="card">
                <h2>Pièces</h2>
                <ul className="esp-pieces">
                  {x.pieces.map((p) => {
                    const fichiers = (p.fichiers as FichierStocke[]) ?? [];
                    return (
                      <li key={p.id}>
                        <div>
                          <b>
                            {p.numero ? `${p.numero}. ` : ""}
                            {p.libelle}
                          </b>
                          {p.manquante ? <span className="pill warn">à transmettre par le client</span> : p.verifiee ? <span className="pill ok">vérifiée</span> : <span className="pill n">non vérifiée</span>}
                          {!p.manquante && !p.verifiee && fichiers.length > 0 && (
                            <ActionForm base={{ reference: ref, action: "verifierPiece", id: p.id }} libelle="Marquer vérifiée" classe="btn sm ghost" />
                          )}
                        </div>
                        <div className="esp-fichiers">
                          {fichiers.map((f, i) => (
                            <a key={f.cle} href={`/api/fichier?piece=${p.id}&i=${i}`} target="_blank" rel="noreferrer">
                              {f.nom} ({Math.ceil(f.taille / 1024)} Ko)
                            </a>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                  {x.pieces.length === 0 && <li className="vide">Aucune pièce.</li>}
                </ul>
                <div className="cab-actions">
                  <ActionForm
                    base={{ reference: ref, action: "demanderPiece" }}
                    champs={[{ nom: "libelle", type: "text", label: "Demander une pièce au client" }]}
                    libelle="Demander"
                  />
                  <FormPiece reference={ref} api="/api/avocat/pieces" />
                </div>
              </section>
            )}

            {onglet === "echeances" && (
              <section className="card">
                <h2>Échéances</h2>
                <ul className="esp-lignes">
                  {x.echeances.map((e) => (
                    <li key={e.id}>
                      <span>
                        {LIB_ECH[e.type] ?? e.type} · <b>{frDate(e.date)}</b> {e.faite && <span className="pill ok">faite</span>}
                      </span>
                      {!e.faite && <ActionForm base={{ reference: ref, action: "echeanceFaite", id: e.id }} libelle="Marquer faite" classe="btn sm ghost" />}
                    </li>
                  ))}
                  {x.echeances.length === 0 && <li className="vide">Aucune échéance. La date limite vérifiée crée la première.</li>}
                </ul>
                <ActionForm
                  base={{ reference: ref, action: "echeance" }}
                  champs={[
                    { nom: "type", type: "select", label: "Type", defaut: TYPES_ECHEANCE[0], options: TYPES_ECHEANCE.map((t) => [t, LIB_ECH[t]]) },
                    { nom: "date", type: "date", label: "Date" },
                  ]}
                  libelle="Ajouter l'échéance"
                />
              </section>
            )}

            {onglet === "documents" && (
              <div className="cab-deux">
                <section className="card">
                  <h2>Convention d&apos;honoraires</h2>
                  {x.conventions.map((c) => (
                    <details key={c.id} className="esp-conv">
                      <summary>
                        Acceptée le {frDateHeure(c.accepteeLe)} · version {c.version} · IP {c.ip}
                      </summary>
                      <pre>{c.texte}</pre>
                      <p className="note">
                        Empreinte SHA-256 : <code>{c.empreinte}</code>
                      </p>
                    </details>
                  ))}
                  {x.conventions.length === 0 && <p className="vide">Aucune convention.</p>}
                </section>
                <section className="card">
                  <h2>Paiements</h2>
                  <ul className="esp-lignes">
                    {x.paiements.map((p) => (
                      <li key={p.id}>
                        <span>
                          {frDateHeure(p.creeLe)} · {p.moyen ?? "—"} {p.parTiers ? "· par un proche" : ""}
                        </span>
                        <b>
                          {formatEuros(p.montant)} <span className={`pill ${p.statut === "PAYE" ? "ok" : "warn"}`}>{p.statut}</span>
                        </b>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}

            {onglet === "journal" && (
              <section className="card">
                <h2>Journal du dossier</h2>
                <p className="note">Journal inaltérable : chaque entrée est chaînée à la précédente par son empreinte.</p>
                <div className="tbl-w">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Acteur</th>
                        <th>Action</th>
                        <th>Empreinte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map((l) => (
                        <tr key={l.id}>
                          <td>{frDateHeure(l.le)}</td>
                          <td>{noms.get(l.acteur) ?? l.acteur}</td>
                          <td>{l.action}</td>
                          <td>
                            <code>{l.empreinte.slice(0, 10)}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        );
      }}
    </Cadre>
  );
}
