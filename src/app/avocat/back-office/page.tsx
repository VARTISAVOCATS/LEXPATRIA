// Lot 4 : back office (associés). Assistant de modification, contenus du site, équipe, historique.
import Link from "next/link";
import { db } from "@/db";
import { LIBELLES_DILIGENCE, PROCEDURES, type CodeProcedure } from "@/lib/procedures";
import { tous } from "@/lib/serveur/blog";
import Blog from "./Blog";
import { CLES_PARAMETRES, PARAMETRES, type CleParametre } from "@/lib/parametres";
import { dernieresPropositions, type ChangementPropose } from "@/lib/serveur/assistant";
import { equipe } from "@/lib/serveur/cabinet";
import { chiffrementDisponible, etatConnexions, nomSynchro } from "@/lib/serveur/connexions";
import { historique, lireParametre } from "@/lib/serveur/parametres";
import { frDateHeure } from "@/lib/statuts";
import { ActionForm } from "../Actions";
import { Cadre } from "../cadre";
import { FormConnexion } from "./Connexions";
import Modeles from "./Modeles";
import Equipe from "./Equipe";
import ActesReference from "./ActesReference";
import { qualiteDe } from "@/lib/equipe";
import { actesReferenceListe } from "@/lib/serveur/actes-reference";
import { LIBELLES_MODELE, type CodeModele } from "@/lib/modeles";
import { etatConventions, etatModeles } from "@/lib/serveur/modeles-cabinet";
import { CODES_CONVENTION, modeleIntegre, VARIABLES_CONVENTION } from "@/lib/convention";
import { VARIABLES } from "@/lib/modeles";
import { Assistant, EditeurAccueil, EditeurAvocats, EditeurDelais, EditeurFaq, EditeurEcheancier, EditeurRemuneration, EditeurTarifs } from "./Editeurs";

export const metadata = { title: "Back office — Espace cabinet", robots: { index: false } };

const RUBRIQUES = [
  ["assistant", "Assistant"],
  ["contenus", "Contenus et tarifs"],
  ["modeles", "Modèles d'actes"],
  ["conventions", "Conventions d'honoraires"],
  ["blog", "Blog"],
  ["equipe", "Équipe"],
  ["connexions", "Connexions (API)"],
  ["historique", "Historique"],
] as const;

const euros = (c: unknown) => (typeof c === "number" ? `${(c / 100).toLocaleString("fr-FR")} €` : String(c));

/** Lignes « avant → après » lisibles par un associé. */
function ecarts(c: ChangementPropose): string[] {
  if (c.type === "indisponibilite") return [`Absent du ${c.debut.split("-").reverse().join("/")} au ${c.fin.split("-").reverse().join("/")}`];
  if (c.type === "attribution") return [c.ouverte ? "Reçoit de nouveau des dossiers" : "Ne reçoit plus de nouveaux dossiers"];
  const avant = c.avant as Record<string, unknown> | unknown[];
  const apres = c.valeur as Record<string, unknown> | unknown[];
  if (c.cle === "remuneration") return [`Rémunération par acte : ${euros((avant as Record<string, unknown>).acteHT)} HT → ${euros((apres as Record<string, unknown>).acteHT)} HT`];
  if (c.cle === "tarifs") {
    return Object.keys(apres as object)
      .filter((k) => (avant as Record<string, unknown>)[k] !== (apres as Record<string, unknown>)[k])
      .map((k) => `${LIBELLES_DILIGENCE[k as keyof typeof LIBELLES_DILIGENCE] ?? k} : ${euros((avant as Record<string, unknown>)[k])} → ${euros((apres as Record<string, unknown>)[k])}`);
  }
  if (Array.isArray(apres)) {
    const a = (avant as unknown[]).map((x) => JSON.stringify(x));
    const b = apres.map((x) => JSON.stringify(x));
    const lignes = [
      ...b.filter((x) => !a.includes(x)).map((x) => `Ajouté ou modifié : ${Object.values(JSON.parse(x)).join(" — ")}`),
      ...a.filter((x) => !b.includes(x)).map((x) => `Retiré ou remplacé : ${Object.values(JSON.parse(x)).join(" — ")}`),
    ];
    return lignes.length ? lignes : ["Ordre modifié"];
  }
  return Object.keys(apres as object)
    .filter((k) => JSON.stringify((avant as Record<string, unknown>)[k]) !== JSON.stringify((apres as Record<string, unknown>)[k]))
    .map((k) => `${k} : « ${String((avant as Record<string, unknown>)[k])} » → « ${String((apres as Record<string, unknown>)[k])} »`);
}

const STATUTS_PROP: Record<string, [string, string]> = {
  PROPOSEE: ["À valider", "warn"],
  APPLIQUEE: ["Appliquée", "ok"],
  REJETEE: ["Rejetée", "n"],
  ECHEC: ["Échec", "bad"],
  QUESTION: ["Précision demandée", "ai"],
  EVOLUTION: ["Évolution du site", "ai"],
};

export default async function BackOffice({ searchParams }: { searchParams: Promise<{ rubrique?: string }> }) {
  const { rubrique: r } = await searchParams;
  const rubrique = RUBRIQUES.find(([k]) => k === r)?.[0] ?? "assistant";
  return (
    <Cadre actif="backoffice">
      {async (m) => {
        if (m.role !== "ASSOCIE") return <p className="card">Le back office est réservé aux associés.</p>;
        const d = await db();
        const noms = new Map((await equipe(d)).map((u) => [u.id, `${u.prenom} ${u.nom}`]));
        return (
          <div className="bo">
            <nav className="chips" aria-label="Rubriques du back office">
              {RUBRIQUES.map(([k, l]) => (
                <Link key={k} href={`/avocat/back-office?rubrique=${k}`} className={`chip-f ${k === rubrique ? "on" : ""}`}>
                  {l}
                </Link>
              ))}
            </nav>

            {rubrique === "assistant" && (
              <>
                <section className="card">
                  <h2>Assistant de modification</h2>
                  <p className="note">
                    Décrivez la modification en français. L&apos;assistant prépare une proposition ; rien n&apos;est publié avant votre validation. Il ne lit jamais les dossiers des
                    clients. Les demandes qui exigent de modifier le code (nouvel écran, nouvelle procédure) sont classées « évolution du site » et transmises à l&apos;agent de
                    développement.
                  </p>
                  <Assistant />
                </section>
                {(await dernieresPropositions(d)).map((p) => {
                  const [lib, cl] = STATUTS_PROP[p.statut] ?? [p.statut, "n"];
                  const changements = p.changements as ChangementPropose[];
                  const alertes = p.alertes as string[];
                  return (
                    <section key={p.id} className="card bo-prop">
                      <div className="esp-etat">
                        <span className={`pill ${cl}`}>{lib}</span>
                        <span className="note">
                          {frDateHeure(p.creeLe)} · {noms.get(p.auteurId) ?? ""}
                        </span>
                      </div>
                      <p className="bo-demande">« {p.demande} »</p>
                      {p.resume && <p>{p.resume}</p>}
                      {changements.map((c, i) => (
                        <div key={i} className="box">
                          <h4>{c.libelle ?? c.type}</h4>
                          <ul>
                            {ecarts(c).map((l, j) => (
                              <li key={j}>{l}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      {alertes.length > 0 && (
                        <ul className="bo-alertes">
                          {alertes.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      )}
                      {p.statut === "PROPOSEE" && (
                        <div className="cab-actions">
                          {alertes.length === 0 && (
                            <ActionForm api="/api/backoffice" base={{ action: "decider", id: p.id, valider: true }} libelle="Valider et publier" classe="btn cta sm" />
                          )}
                          <ActionForm api="/api/backoffice" base={{ action: "decider", id: p.id, valider: false }} libelle="Rejeter" classe="btn sm ghost" />
                        </div>
                      )}
                    </section>
                  );
                })}
              </>
            )}

            {rubrique === "contenus" && (
              <>
                {await Promise.all(
                  CLES_PARAMETRES.map(async (cle: CleParametre) => {
                    const valeur = await lireParametre(d, cle);
                    return (
                      <section key={cle} className="card">
                        <h2>{PARAMETRES[cle].libelle}</h2>
                        <p className="note">{PARAMETRES[cle].aide}</p>
                        {cle === "tarifs" && <EditeurTarifs valeur={valeur as Record<string, number>} libelles={LIBELLES_DILIGENCE} />}
                        {cle === "faq" && <EditeurFaq valeur={valeur as { q: string; r: string }[]} />}
                        {cle === "avocats" && <EditeurAvocats valeur={valeur as { nom: string; titre: string; photo: string | null }[]} />}
                        {cle === "accueil" && <EditeurAccueil valeur={valeur as { titre: string; sousTitre: string }} />}
                        {cle === "delais" && <EditeurDelais valeur={valeur as { acceptationNormaleH: number; acceptationUrgenceH: number }} />}
                        {cle === "remuneration" && <EditeurRemuneration valeur={valeur as { acteHT: number }} />}
                        {cle === "echeancier" && <EditeurEcheancier valeur={valeur as Parameters<typeof EditeurEcheancier>[0]["valeur"]} />}
                      </section>
                    );
                  }),
                )}
                <p className="note">
                  Les textes modifiés s&apos;affichent en français dans toutes les langues tant que leur traduction n&apos;est pas faite.
                </p>
              </>
            )}

            {rubrique === "modeles" &&
              (await (async () => {
                const etat = await etatModeles(d);
                const refs = await actesReferenceListe(d);
                return (
                  <>
                  <Modeles
                    variables={VARIABLES.map(({ nom, libelle }) => ({ nom, libelle }))}
                    modeles={etat.map((m) => ({
                      code: m.code,
                      libelle: m.libelle,
                      cabinet: m.cabinet,
                      texte: m.actuel?.texte ?? "",
                      versions: m.versions.map((v) => ({ id: v.id, version: v.version, le: frDateHeure(v.creeLe), fichier: v.fichier, vide: !v.texte.trim() })),
                    }))}
                  />
                  <ActesReference
                    types={(Object.keys(LIBELLES_MODELE) as CodeModele[]).map((c) => [c, LIBELLES_MODELE[c]])}
                    actes={refs.map((a) => ({ id: a.id, code: a.code, titre: a.titre, fichier: a.fichier, actif: a.actif, le: frDateHeure(a.creeLe), longueur: a.texte.length }))}
                  />
                  </>
                );
              })())}

            {rubrique === "conventions" &&
              (await (async () => {
                const etat = await etatConventions(d);
                return (
                  <Modeles
                    api="/api/backoffice/conventions"
                    libelleType="Modèle de convention"
                    application="Il s'applique aux conventions acceptées ensuite ; les conventions déjà acceptées restent archivées à l'identique."
                    variables={VARIABLES_CONVENTION.map(({ nom, libelle }) => ({ nom, libelle }))}
                    integres={Object.fromEntries(CODES_CONVENTION.map((c) => [c, modeleIntegre(c)]))}
                    modeles={etat.map((m) => ({
                      code: m.code,
                      libelle: m.libelle,
                      cabinet: m.cabinet,
                      texte: m.actuel?.texte ?? "",
                      versions: m.versions.map((v) => ({ id: v.id, version: v.version, le: frDateHeure(v.creeLe), fichier: v.fichier, vide: !v.texte.trim() })),
                    }))}
                  />
                );
              })())}

            {rubrique === "blog" &&
              (await (async () => {
                const liste = await tous(d);
                return (
                  <Blog
                    procedures={(Object.keys(PROCEDURES) as CodeProcedure[]).map((c) => [c, PROCEDURES[c].libelle])}
                    articles={liste.map((a) => ({
                      id: a.id,
                      slug: a.slug,
                      titre: a.titre,
                      chapo: a.chapo,
                      contenu: a.contenu,
                      procedure: a.procedure,
                      publie: a.publie,
                      le: frDateHeure(a.majLe),
                    }))}
                  />
                );
              })())}

            {rubrique === "equipe" &&
              (await (async () => {
                const acteCabinet = (await lireParametre(d, "remuneration")).acteHT;
                const e = (x: number | null) => (x == null ? null : x / 100);
                return (
                  <Equipe
                    acteCabinet={acteCabinet}
                    membres={(await equipe(d)).map((u) => ({
                      id: u.id,
                      prenom: u.prenom,
                      nom: u.nom,
                      email: u.email,
                      qualite: qualiteDe(u),
                      titre: u.titre ?? "",
                      barreau: u.barreau,
                      mobile: u.mobile ?? "",
                      photoUrl: u.photoUrl ?? "",
                      remuneration: u.remuneration,
                      fixeMensuel: e(u.fixeMensuelHT),
                      seuilVariable: e(u.seuilVariableHT),
                      tauxVariable: u.tauxVariable == null ? null : Math.round(u.tauxVariable * 1000) / 10,
                      acte: e(u.acteHT),
                      avis: e(u.avisHT),
                      validationAssocie: u.validationAssocie,
                      attributionOuverte: u.attributionOuverte,
                      actif: u.actif,
                      moi: u.id === m.id,
                    }))}
                  />
                );
              })())}

            {rubrique === "connexions" && (
              <>
                <section className="card">
                  <h2>Connexions aux services (API)</h2>
                  <p className="note">
                    Branchez ici les services utilisés par la plateforme. Les clés sont chiffrées sur le serveur et ne sont plus jamais affichées : seul un aperçu des
                    4 derniers caractères reste visible. Une valeur saisie ici remplace celle du fichier de configuration du serveur. Chaque modification est inscrite au
                    journal, sans la valeur.
                  </p>
                  {!chiffrementDisponible() && (
                    <p className="bo-alertes">Le serveur n&apos;a pas de clé de chiffrement (CLE_CHIFFREMENT) : l&apos;enregistrement des clés est désactivé.</p>
                  )}
                </section>
                {(await etatConnexions(d)).map((c) => (
                  <section key={c.id} className="card cx-carte">
                    <div className="cx-tete">
                      <div>
                        <h2>{c.nom}</h2>
                        <p className="note">{c.usage}</p>
                      </div>
                      <div className="cx-badges">
                        {c.lot && <span className="pill n">{c.lot}</span>}
                        <span className={`pill ${c.complet ? "ok" : c.facultatif ? "n" : "warn"}`}>{c.complet ? "Configuré" : c.facultatif ? "Non utilisé" : "À configurer"}</span>
                        {c.testLe && <span className={`pill ${c.testOk ? "ok" : "bad"}`}>{c.testOk ? "Essai réussi" : "Essai échoué"}</span>}
                      </div>
                    </div>
                    <ul className="cx-liste">
                      {c.champs.map((ch) => (
                        <li key={ch.nom}>
                          <span>{ch.libelle}</span>
                          <span>
                            {ch.apercu ? <code>{ch.apercu}</code> : <span className="vide">non renseigné</span>}
                            {ch.source && <span className="pill n">{ch.source}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {c.testMessage && (
                      <p className="note">
                        Dernier essai le {frDateHeure(c.testLe)} : {c.testMessage}
                      </p>
                    )}
                    {c.syncs.map((x) => (
                      <p key={x.service} className="note">
                        <span className={`pill ${x.ok ? "ok" : "bad"}`}>{nomSynchro(x.service)}</span> dernière exécution le {frDateHeure(x.le)} : {x.message}
                      </p>
                    ))}
                    <p className="note">Où trouver ces informations : {c.ou}</p>
                    <FormConnexion service={c.id} champs={c.champs} testable={c.test} />
                  </section>
                ))}
              </>
            )}

            {rubrique === "historique" && (
              <section className="card">
                <h2>Historique des modifications</h2>
                <p className="note">Chaque modification peut être annulée : la valeur qui la précédait est rétablie (et cette annulation est elle-même historisée).</p>
                <div className="tbl-w">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Contenu</th>
                        <th>Par</th>
                        <th>Origine</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(await historique(d)).map((h) => (
                        <tr key={h.id}>
                          <td>{frDateHeure(h.le)}</td>
                          <td>{PARAMETRES[h.cle as CleParametre]?.libelle ?? h.cle}</td>
                          <td>{noms.get(h.majPar) ?? h.majPar}</td>
                          <td>{h.origine === "ASSISTANT" ? "Assistant (validé)" : h.origine === "RETOUR_ARRIERE" ? "Retour arrière" : "Manuel"}</td>
                          <td>
                            <ActionForm
                              api="/api/backoffice"
                              base={{ action: "restaurer", id: h.id }}
                              libelle="Annuler cette modification"
                              classe="btn sm ghost"
                              confirmation="La valeur précédente sera republiée immédiatement."
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        );
      }}
    </Cadre>
  );
}
