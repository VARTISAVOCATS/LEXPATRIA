"use client";
// Poste de travail de l'avocat : analyse de l'IA, projet d'acte, revue humaine, contrôle croisé, attestation, assistant.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Point {
  id: string;
  texte: string;
  tranche: boolean;
}
interface AnalyseV {
  resume: string;
  questions: string[];
  appuis: string[];
  strategie: string;
  vigilance: Point[];
  source: "IA" | "SIMULATION";
  le: string;
}
interface ActeV {
  id: string;
  type: string;
  version: number;
  contenu: string;
  motsModifies: number;
  tempsRevueS: number;
}

export interface ProprietesPoste {
  reference: string;
  analyse: AnalyseV | null;
  acte: ActeV | null;
  versions: { id: string; version: number; le: string; mots: number }[];
  modeles: [string, string][];
  libelleActe: string | null;
  controle: { libelle: string; ok: boolean }[];
  attestation: { le: string; version: number } | null;
  texteAttestation: string;
  peutAttester: boolean;
  transmisLe: string | null;
  priseEnCharge: { le: string } | null;
  dateLimiteVerifiee: boolean;
}

async function poster(corps: object) {
  const r = await fetch("/api/avocat/poste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) }).catch(() => null);
  const j = await r?.json().catch(() => null);
  return { ok: !!r?.ok, j };
}

function Surligne({ texte }: { texte: string }) {
  return (
    <pre className="pt-apercu">
      {texte.split(/(XXX)/).map((m, i) =>
        m === "XXX" ? (
          <mark key={i} className="pt-xxx">
            XXX
          </mark>
        ) : (
          m
        ),
      )}
    </pre>
  );
}

const duree = (s: number) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}`);

export default function PosteTravail(p: ProprietesPoste) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [texte, setTexte] = useState(p.acte?.contenu ?? "");
  const [apercu, setApercu] = useState(true);
  const [modele, setModele] = useState(p.modeles[0]?.[0] ?? "");
  const [secondes, setSecondes] = useState(0);
  const [question, setQuestion] = useState("");
  const [reponses, setReponses] = useState<{ q: string; r: string }[]>([]);
  const [coche, setCoche] = useState(false);
  // Cases « tranché » : affichage immédiat, confirmé par le serveur.
  const [tranches, setTranches] = useState<Record<string, boolean>>({});
  useEffect(() => setTranches({}), [p.analyse]);
  const estTranche = (v: Point) => tranches[v.id] ?? v.tranche;
  const derniereActivite = useRef(Date.now());

  useEffect(() => setTexte(p.acte?.contenu ?? ""), [p.acte?.id, p.acte?.contenu]);

  // Temps de revue active : compté seulement si la page est visible et qu'il y a eu une interaction depuis moins d'une minute.
  useEffect(() => {
    const marquer = () => (derniereActivite.current = Date.now());
    window.addEventListener("keydown", marquer);
    window.addEventListener("scroll", marquer, true);
    window.addEventListener("mousemove", marquer);
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - derniereActivite.current < 60_000) setSecondes((s) => s + 1);
    }, 1000);
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", marquer);
      window.removeEventListener("scroll", marquer, true);
      window.removeEventListener("mousemove", marquer);
    };
  }, []);

  const manquants = useMemo(() => (texte.match(/XXX/g) ?? []).length, [texte]);
  const modifie = !!p.acte && texte !== p.acte.contenu;

  async function agir(action: string, extra: object = {}, cle = action) {
    setEnvoi(cle);
    setErreur(null);
    const { ok, j } = await poster({ reference: p.reference, action, ...extra });
    setEnvoi(null);
    if (!ok) return setErreur(j?.erreur ?? "L'action a échoué.");
    if (action === "enregistrer") setSecondes(0);
    if (action === "attester") setCoche(false);
    router.refresh();
    return j;
  }

  async function demander(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setEnvoi("question");
    const { ok, j } = await poster({ reference: p.reference, action: "question", question: q });
    setEnvoi(null);
    if (!ok) return setErreur(j?.erreur ?? "L'assistant n'a pas répondu.");
    setReponses([{ q, r: j.reponse }, ...reponses]);
    setQuestion("");
  }

  const pointsOuverts = p.analyse?.vigilance.filter((v) => !estTranche(v)).length ?? 0;
  const controleOk = p.controle.every((c) => c.ok);

  return (
    <div className="pt">
      {erreur && (
        <p className="bo-alertes" role="alert">
          {erreur}
        </p>
      )}
      <div className="pt-grille">
        <div className="pt-principal">
          {/* ----- Analyse ----- */}
          <section className="card">
            <div className="cx-tete">
              <h2>Analyse</h2>
              <div className="cx-badges">
                <span className="pill ai">{p.analyse?.source === "IA" ? "Avis de l'IA · pour vous, non transmis" : p.analyse ? "Analyse d'essai (sans clé IA)" : "Pour vous, non transmise au client"}</span>
                <button className="btn sm ghost" disabled={!!envoi} onClick={() => agir("analyser")}>
                  {envoi === "analyser" ? "Analyse…" : p.analyse ? "Régénérer" : "Lancer l'analyse"}
                </button>
              </div>
            </div>
            {!p.analyse ? (
              <p className="vide">Aucune analyse. L&apos;IA lit le récit, le questionnaire et les pièces, puis propose une première analyse.</p>
            ) : (
              <>
                <p>{p.analyse.resume}</p>
                {p.analyse.questions.length > 0 && (
                  <>
                    <h3>Questions soulevées</h3>
                    <ul>
                      {p.analyse.questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </>
                )}
                {p.analyse.appuis.length > 0 && (
                  <>
                    <h3>Points d&apos;appui</h3>
                    <ul>
                      {p.analyse.appuis.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </>
                )}
                <h3>Stratégie suggérée</h3>
                <p>{p.analyse.strategie}</p>
                <h3>
                  Points de vigilance {pointsOuverts > 0 ? <span className="pill warn">{pointsOuverts} à trancher</span> : <span className="pill ok">tous tranchés</span>}
                </h3>
                <p className="note">Cochez chaque point une fois tranché : l&apos;attestation n&apos;est possible qu&apos;ensuite.</p>
                <ul className="pt-vigilance">
                  {p.analyse.vigilance.map((v) => (
                    <li key={v.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={estTranche(v)}
                          onChange={(e) => {
                            setTranches({ ...tranches, [v.id]: e.target.checked });
                            void agir("trancher", { id: v.id, tranche: e.target.checked }, v.id);
                          }}
                        />
                        <span>{v.texte}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* ----- Projet d'acte ----- */}
          <section className="card">
            <div className="cx-tete">
              <h2>{p.libelleActe ? `${p.libelleActe} · version ${p.acte?.version}` : "Projet d'acte"}</h2>
              <div className="cx-badges">
                <select className="champ pt-modele" value={modele} onChange={(e) => setModele(e.target.value)} aria-label="Modèle d'acte">
                  {p.modeles.map(([c, l]) => (
                    <option key={c} value={c}>
                      {l}
                    </option>
                  ))}
                </select>
                <button className="btn sm" disabled={!!envoi} onClick={() => agir("generer", { modele })}>
                  {envoi === "generer" ? "Préparation…" : p.acte ? "Nouveau projet" : "Préparer le projet"}
                </button>
              </div>
            </div>
            {!p.acte ? (
              <p className="vide">Choisissez le modèle, puis préparez le projet. Toute information manquante apparaît en XXX surligné.</p>
            ) : (
              <>
                <div className="pt-barre">
                  <span className={`pill ${manquants ? "warn" : "ok"}`}>{manquants ? `${manquants} mention(s) XXX à compléter` : "Aucune mention XXX"}</span>
                  <span className="pill n">{p.acte.motsModifies} mot(s) modifié(s) par vous</span>
                  <span className="pill n">Revue active : {duree(p.acte.tempsRevueS + secondes)}</span>
                  <span className="pt-espace" />
                  <button className="btn sm ghost" onClick={() => setApercu(!apercu)}>
                    {apercu ? "Modifier le texte" : "Aperçu surligné"}
                  </button>
                  <a className="btn sm ghost" href={`/api/avocat/acte/${p.acte.id}`}>
                    Ouvrir dans Word
                  </a>
                </div>
                {apercu ? (
                  <Surligne texte={texte} />
                ) : (
                  <textarea className="champ pt-editeur" value={texte} onChange={(e) => setTexte(e.target.value)} spellCheck lang="fr" aria-label="Texte de l'acte" />
                )}
                <div className="bo-pied">
                  <button className="btn cta sm" disabled={!modifie || !!envoi} onClick={() => agir("enregistrer", { contenu: texte, secondes })}>
                    {envoi === "enregistrer" ? "Enregistrement…" : "Enregistrer la version"}
                  </button>
                  {modifie && (
                    <button className="btn sm ghost" onClick={() => setTexte(p.acte!.contenu)}>
                      Annuler les modifications
                    </button>
                  )}
                  {modifie && p.attestation && <span className="note warn">Enregistrer cette modification annulera l&apos;attestation.</span>}
                </div>
                {p.versions.length > 1 && (
                  <details className="pt-versions">
                    <summary>{p.versions.length} versions</summary>
                    <ul>
                      {p.versions.map((v) => (
                        <li key={v.id}>
                          Version {v.version} · {v.le} · {v.mots} mot(s) modifié(s) ·{" "}
                          <a href={`/api/avocat/acte/${v.id}`}>Word</a>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </section>
        </div>

        <aside className="pt-cote">
          {/* ----- Contrôle croisé ----- */}
          <section className="card">
            <h2>Contrôle avant dépôt</h2>
            <ul className="pt-controle">
              {p.controle.map((c) => (
                <li key={c.libelle} className={c.ok ? "ok" : "ko"}>
                  <span aria-hidden>{c.ok ? "✓" : "✕"}</span> {c.libelle}
                </li>
              ))}
            </ul>
            <p className="note">
              {p.controle.filter((c) => c.ok).length} / {p.controle.length}
            </p>
          </section>

          {/* ----- Revue humaine et attestation ----- */}
          <section className="card">
            <h2>Revue humaine et attestation</h2>
            {p.attestation ? (
              <>
                <p className="box">
                  Version {p.attestation.version} attestée le {p.attestation.le}. Toute modification ultérieure demandera une nouvelle attestation.
                </p>
                {p.transmisLe ? (
                  <p className="note">Transmis au secrétariat pour dépôt le {p.transmisLe}.</p>
                ) : (
                  <button className="btn cta sm" disabled={!!envoi} onClick={() => agir("transmettre")}>
                    Transmettre au secrétariat pour dépôt
                  </button>
                )}
              </>
            ) : (
              <>
                <label className="pt-attest">
                  <input type="checkbox" checked={coche} disabled={!p.acte || !p.peutAttester} onChange={(e) => setCoche(e.target.checked)} />
                  <span>{p.texteAttestation}</span>
                </label>
                <button className="btn cta sm" disabled={!coche || !controleOk || modifie || !!envoi || !p.peutAttester} onClick={() => agir("attester")}>
                  Attester cette version
                </button>
                <p className="note">
                  Sans attestation, aucun dépôt ni envoi n&apos;est possible et l&apos;acte n&apos;est pas rémunéré. L&apos;attestation porte sur la version affichée.
                  {modifie ? " Enregistrez d'abord vos modifications." : ""}
                  {!controleOk ? " Le contrôle avant dépôt doit être complet." : ""}
                </p>
              </>
            )}
          </section>

          {/* ----- Attestation de prise en charge ----- */}
          <section className="card">
            <h2>Attestation de prise en charge</h2>
            {p.priseEnCharge ? (
              <p className="note">Signée le {p.priseEnCharge.le} et mise à disposition du client dans son espace.</p>
            ) : (
              <>
                <p className="note">À signer après vérification de la date de notification et de la date limite : elle est alors remise au client.</p>
                <button className="btn sm" disabled={!p.dateLimiteVerifiee || !p.peutAttester || !!envoi} onClick={() => agir("priseEnCharge")}>
                  Dates vérifiées — signer l&apos;attestation
                </button>
              </>
            )}
          </section>

          {/* ----- Assistant IA du dossier ----- */}
          <section className="card">
            <h2>Assistant IA</h2>
            <p className="note">Il connaît le dossier, les pièces et le projet. Ses réponses vous sont destinées ; vérifiez toute référence avant usage.</p>
            <form onSubmit={demander} className="esp-form">
              <textarea className="champ" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Relis le projet ; quels moyens manquent ? ; que dit la décision sur… ?" />
              <div className="esp-form-b">
                <button className="btn sm" disabled={!question.trim() || !!envoi}>
                  {envoi === "question" ? "Réflexion…" : "Demander"}
                </button>
              </div>
            </form>
            {reponses.map((r, i) => (
              <div key={i} className="pt-reponse">
                <b>{r.q}</b>
                <p>{r.r}</p>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
