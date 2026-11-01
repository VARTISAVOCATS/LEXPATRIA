"use client";
// Éditeurs des contenus du back office. Chaque enregistrement passe par le filtre déontologique et l'historique.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAS_DEFAUT, DILIGENCES_COMPLEMENTAIRES, MODELES_CAS, PROCEDURES_CAS, type Cas } from "@/lib/cas";
import { LIBELLES_MODELE } from "@/lib/modeles";
import { LIBELLES_DILIGENCE, PROCEDURES } from "@/lib/procedures";

function useEnregistrer() {
  const router = useRouter();
  const [etat, setEtat] = useState<{ envoi: boolean; erreur: string | null; ok: boolean }>({ envoi: false, erreur: null, ok: false });
  async function enregistrer(corps: object) {
    setEtat({ envoi: true, erreur: null, ok: false });
    const r = await fetch("/api/backoffice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok) return setEtat({ envoi: false, erreur: j?.erreur ?? "Échec de l'enregistrement.", ok: false });
    setEtat({ envoi: false, erreur: null, ok: true });
    router.refresh();
  }
  return { ...etat, enregistrer };
}

function Pied({ envoi, erreur, ok, libelle = "Enregistrer" }: { envoi: boolean; erreur: string | null; ok: boolean; libelle?: string }) {
  return (
    <div className="bo-pied">
      <button className="btn cta sm" disabled={envoi}>
        {envoi ? "Enregistrement…" : libelle}
      </button>
      {ok && <span className="pill ok">Enregistré et publié</span>}
      {erreur && <span className="erreur">{erreur}</span>}
    </div>
  );
}

export function EditeurTarifs({ valeur, libelles }: { valeur: Record<string, number>; libelles: Record<string, string> }) {
  const [v, setV] = useState(Object.fromEntries(Object.entries(valeur).map(([k, c]) => [k, String(c / 100)])));
  const e = useEnregistrer();
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        e.enregistrer({ action: "parametre", cle: "tarifs", valeur: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.round(Number(x.replace(",", ".")) * 100)])) });
      }}
    >
      <div className="bo-tarifs">
        {Object.keys(valeur).map((k) => (
          <label key={k} className="af-c">
            <span>{libelles[k] ?? k}</span>
            <span className="bo-euros">
              <input className="champ" inputMode="decimal" value={v[k]} onChange={(x) => setV({ ...v, [k]: x.target.value })} /> €
            </span>
          </label>
        ))}
      </div>
      <Pied {...e} />
    </form>
  );
}

export function EditeurFaq({ valeur }: { valeur: { q: string; r: string }[] }) {
  const [v, setV] = useState(valeur);
  const e = useEnregistrer();
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        e.enregistrer({ action: "parametre", cle: "faq", valeur: v });
      }}
    >
      {v.map((f, i) => (
        <div key={i} className="bo-item">
          <label className="af-c">
            <span>Question {i + 1}</span>
            <input className="champ" value={f.q} onChange={(x) => setV(v.map((y, j) => (j === i ? { ...y, q: x.target.value } : y)))} />
          </label>
          <label className="af-c">
            <span>Réponse</span>
            <textarea className="champ" rows={3} value={f.r} onChange={(x) => setV(v.map((y, j) => (j === i ? { ...y, r: x.target.value } : y)))} />
          </label>
          <div className="bo-item-b">
            <button type="button" className="btn sm ghost" disabled={i === 0} onClick={() => setV(v.map((y, j) => (j === i - 1 ? v[i] : j === i ? v[i - 1] : y)))}>
              Monter
            </button>
            <button type="button" className="btn sm ghost" onClick={() => setV(v.filter((_, j) => j !== i))}>
              Retirer
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn sm" onClick={() => setV([...v, { q: "", r: "" }])}>
        Ajouter une question
      </button>
      <Pied {...e} />
    </form>
  );
}

export function EditeurAvocats({ valeur }: { valeur: { nom: string; titre: string; photo: string | null }[] }) {
  const [v, setV] = useState(valeur);
  const e = useEnregistrer();
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        e.enregistrer({ action: "parametre", cle: "avocats", valeur: v.map((a) => ({ ...a, photo: a.photo?.trim() ? a.photo.trim() : null })) });
      }}
    >
      {v.map((a, i) => (
        <div key={i} className="bo-item bo-3">
          <label className="af-c">
            <span>Nom</span>
            <input className="champ" value={a.nom} onChange={(x) => setV(v.map((y, j) => (j === i ? { ...y, nom: x.target.value } : y)))} />
          </label>
          <label className="af-c">
            <span>Titre</span>
            <input className="champ" value={a.titre} onChange={(x) => setV(v.map((y, j) => (j === i ? { ...y, titre: x.target.value } : y)))} />
          </label>
          <label className="af-c">
            <span>Photo (chemin)</span>
            <input className="champ" value={a.photo ?? ""} onChange={(x) => setV(v.map((y, j) => (j === i ? { ...y, photo: x.target.value } : y)))} />
          </label>
          <div className="bo-item-b">
            <button type="button" className="btn sm ghost" onClick={() => setV(v.filter((_, j) => j !== i))}>
              Retirer
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn sm" onClick={() => setV([...v, { nom: "Me ", titre: "Avocat au barreau de Paris", photo: null }])}>
        Ajouter un avocat
      </button>
      <Pied {...e} />
    </form>
  );
}

export function EditeurAccueil({ valeur }: { valeur: { titre: string; sousTitre: string } }) {
  const [v, setV] = useState(valeur);
  const e = useEnregistrer();
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        e.enregistrer({ action: "parametre", cle: "accueil", valeur: v });
      }}
    >
      <label className="af-c">
        <span>Titre</span>
        <input className="champ" value={v.titre} onChange={(x) => setV({ ...v, titre: x.target.value })} />
      </label>
      <label className="af-c">
        <span>Sous-titre</span>
        <textarea className="champ" rows={3} value={v.sousTitre} onChange={(x) => setV({ ...v, sousTitre: x.target.value })} />
      </label>
      <Pied {...e} />
    </form>
  );
}

export function EditeurDelais({ valeur }: { valeur: { acceptationNormaleH: number; acceptationUrgenceH: number } }) {
  const [v, setV] = useState({ n: String(valeur.acceptationNormaleH), u: String(valeur.acceptationUrgenceH) });
  const e = useEnregistrer();
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        e.enregistrer({ action: "parametre", cle: "delais", valeur: { acceptationNormaleH: Number(v.n), acceptationUrgenceH: Number(v.u) } });
      }}
    >
      <div className="bo-tarifs">
        <label className="af-c">
          <span>Dossier normal (heures ouvrées)</span>
          <input className="champ" inputMode="numeric" value={v.n} onChange={(x) => setV({ ...v, n: x.target.value })} />
        </label>
        <label className="af-c">
          <span>Dossier urgent (heures ouvrées)</span>
          <input className="champ" inputMode="numeric" value={v.u} onChange={(x) => setV({ ...v, u: x.target.value })} />
        </label>
      </div>
      <Pied {...e} />
    </form>
  );
}

export function EditeurRemuneration({ valeur }: { valeur: { acteHT: number } }) {
  const [v, setV] = useState(String(valeur.acteHT / 100).replace(".", ","));
  const e = useEnregistrer();
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        e.enregistrer({ action: "parametre", cle: "remuneration", valeur: { acteHT: Math.round(Number(v.replace(",", ".")) * 100) } });
      }}
    >
      <div className="bo-tarifs">
        <label className="af-c">
          <span>Par acte attesté (€ HT)</span>
          <input className="champ" inputMode="decimal" value={v} onChange={(x) => setV(x.target.value)} />
        </label>
      </div>
      <Pied {...e} />
    </form>
  );
}

export function EditeurEcheancier({ valeur }: { valeur: { seuil: number; parts: [number, number, number]; intervalleJours: number; penalite: number; regularisationJours: number; tentativesMax: number } }) {
  const [v, setV] = useState({
    seuil: String(valeur.seuil / 100),
    p1: String(valeur.parts[0]),
    p2: String(valeur.parts[1]),
    p3: String(valeur.parts[2]),
    intervalle: String(valeur.intervalleJours),
    penalite: String(valeur.penalite / 100).replace(".", ","),
    regularisation: String(valeur.regularisationJours),
    tentatives: String(valeur.tentativesMax),
  });
  const e = useEnregistrer();
  const n = (x: string) => Number(x.replace(",", "."));
  const champ = (k: keyof typeof v, libelle: string) => (
    <label className="af-c" key={k}>
      <span>{libelle}</span>
      <input className="champ" inputMode="decimal" value={v[k]} onChange={(x) => setV({ ...v, [k]: x.target.value })} />
    </label>
  );
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        e.enregistrer({
          action: "parametre",
          cle: "echeancier",
          valeur: {
            seuil: Math.round(n(v.seuil) * 100),
            parts: [n(v.p1), n(v.p2), n(v.p3)],
            intervalleJours: n(v.intervalle),
            penalite: Math.round(n(v.penalite) * 100),
            regularisationJours: n(v.regularisation),
            tentativesMax: n(v.tentatives),
          },
        });
      }}
    >
      <div className="bo-tarifs">
        {champ("seuil", "Proposé à partir de (€ TTC)")}
        {champ("p1", "1re échéance, à la commande (%)")}
        {champ("p2", "2e échéance (%)")}
        {champ("p3", "3e échéance (%)")}
        {champ("intervalle", "Jours entre deux échéances")}
        {champ("penalite", "Pénalité par échéance non régularisée (€)")}
        {champ("regularisation", "Délai de régularisation (jours)")}
        {champ("tentatives", "Tentatives de prélèvement")}
      </div>
      <p className="note">
        Exemple pour 990 € : {Math.round((990 * n(v.p1)) / 100)} € à la commande, puis {Math.floor((990 * n(v.p2)) / 100)} € à {n(v.intervalle)} jours et {Math.floor((990 * n(v.p3)) / 100)} € à {2 * n(v.intervalle)} jours.
      </p>
      <Pied {...e} />
    </form>
  );
}

export function Assistant() {
  const [demande, setDemande] = useState("");
  const e = useEnregistrer();
  return (
    <form
      className="bo-assistant"
      onSubmit={async (ev) => {
        ev.preventDefault();
        await e.enregistrer({ action: "proposer", demande });
        setDemande("");
      }}
    >
      <label className="af-c" htmlFor="bo-demande">
        <span>Que souhaitez-vous modifier ?</span>
      </label>
      <textarea
        id="bo-demande"
        className="champ"
        rows={3}
        value={demande}
        onChange={(x) => setDemande(x.target.value)}
        placeholder="Exemples : « passe le recours OQTF à 1 090 € » · « ajoute une question sur les délais dans la FAQ » · « Me Kachi est absent du 2026-11-02 au 2026-11-09 »"
        required
      />
      <Pied envoi={e.envoi} erreur={e.erreur} ok={false} libelle={e.envoi ? "Préparation…" : "Préparer la proposition"} />
    </form>
  );
}

// ——— Référentiel des cas (orientation par l'IA) ———

const lignes = (l: string[]) => l.join("\n");
const versListe = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function EditeurCas({ valeur }: { valeur: Cas[] }) {
  const [v, setV] = useState(valeur);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const e = useEnregistrer();
  const maj = (i: number, champ: Partial<Cas>) => setV(v.map((c, j) => (j === i ? { ...c, ...champ } : c)));
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        e.enregistrer({ action: "parametre", cle: "cas", valeur: v.map((c) => ({ ...c, pieces: versListe(c.pieces.join("\n")), vigilance: versListe(c.vigilance.join("\n")) })) });
      }}
    >
      {v.map((c, i) => (
        <div key={i} className={`bo-item bo-cas ${c.actif ? "" : "bo-inactif"}`}>
          <button type="button" className="bo-cas-t" onClick={() => setOuvert(ouvert === i ? null : i)} aria-expanded={ouvert === i}>
            <b>{c.libelle || "Nouveau cas"}</b>
            <span className="note">
              {c.code} · {PROCEDURES[c.procedure].libelle}
              {c.actif ? "" : " · désactivé"}
            </span>
          </button>
          {ouvert === i && (
            <>
              <div className="bo-3">
                <label className="af-c">
                  <span>Code</span>
                  <input className="champ" value={c.code} onChange={(x) => maj(i, { code: x.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })} />
                </label>
                <label className="af-c">
                  <span>Procédure</span>
                  <select className="champ" value={c.procedure} onChange={(x) => maj(i, { procedure: x.target.value as Cas["procedure"] })}>
                    {PROCEDURES_CAS.map((p) => (
                      <option key={p} value={p}>
                        {PROCEDURES[p].libelle}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="af-c">
                  <span>Modèle d&apos;acte</span>
                  <select className="champ" value={c.modele} onChange={(x) => maj(i, { modele: x.target.value as Cas["modele"] })}>
                    {MODELES_CAS.map((m) => (
                      <option key={m} value={m}>
                        {LIBELLES_MODELE[m]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="af-c">
                <span>Libellé affiché au client</span>
                <input className="champ" value={c.libelle} onChange={(x) => maj(i, { libelle: x.target.value })} />
              </label>
              <label className="af-c">
                <span>Voie de recours affichée au client</span>
                <input className="champ" value={c.voieClient} onChange={(x) => maj(i, { voieClient: x.target.value })} />
              </label>
              <label className="af-c">
                <span>Signes de reconnaissance (pour l&apos;IA)</span>
                <textarea className="champ" rows={4} value={c.signes} onChange={(x) => maj(i, { signes: x.target.value })} />
              </label>
              <div className="bo-3">
                <label className="af-c">
                  <span>Juridiction</span>
                  <textarea className="champ" rows={2} value={c.juridiction} onChange={(x) => maj(i, { juridiction: x.target.value })} />
                </label>
                <label className="af-c">
                  <span>Délai</span>
                  <textarea className="champ" rows={2} value={c.delai} onChange={(x) => maj(i, { delai: x.target.value })} />
                </label>
              </div>
              <div className="bo-3">
                {c.procedure === "OQTF" && (
                  <label className="af-c">
                    <span>Situation fixée par le cas</span>
                    <select className="champ" value={c.situationOQTF ?? ""} onChange={(x) => maj(i, { situationOQTF: (x.target.value || null) as Cas["situationOQTF"] })}>
                      <option value="">Demandée au client</option>
                      <option value="LIBRE">Libre</option>
                      <option value="ASSIGNE">Assigné à résidence</option>
                      <option value="LIBRE_APRES_ASILE">Après rejet de l&apos;asile</option>
                    </select>
                  </label>
                )}
                {c.procedure === "REFUS_VISA" && (
                  <label className="af-c">
                    <span>Type de visa</span>
                    <select className="champ" value={c.visaType ?? ""} onChange={(x) => maj(i, { visaType: (x.target.value || null) as Cas["visaType"] })}>
                      <option value="">Demandé au client</option>
                      <option value="COURT">Court séjour</option>
                      <option value="LONG">Long séjour</option>
                    </select>
                  </label>
                )}
                {c.procedure === "NATURALISATION" && (
                  <label className="af-c">
                    <span>Issue</span>
                    <select className="champ" value={c.naturalisationIssue ?? ""} onChange={(x) => maj(i, { naturalisationIssue: (x.target.value || null) as Cas["naturalisationIssue"] })}>
                      <option value="">Demandée au client</option>
                      <option value="REFUS">Refus</option>
                      <option value="AJOURNEMENT">Ajournement</option>
                    </select>
                  </label>
                )}
                {(c.procedure === "BLOCAGE_SIMPLE" || c.procedure === "BLOCAGE_EMPLOI") && (
                  <label className="af-c">
                    <span>Référé</span>
                    <select className="champ" value={c.refere ?? ""} onChange={(x) => maj(i, { refere: (x.target.value || null) as Cas["refere"] })}>
                      <option value="">Aucun</option>
                      <option value="MESURES_UTILES">Référé mesures utiles (mise en demeure si l&apos;urgence n&apos;est pas établie)</option>
                      <option value="LIBERTE">Référé-liberté d&apos;emblée</option>
                    </select>
                    <label>
                      <input type="checkbox" checked={c.demarche} onChange={(x) => maj(i, { demarche: x.target.checked })} /> Demander la démarche engagée en préfecture
                    </label>
                    {c.refere === "MESURES_UTILES" && (
                      <label>
                        <input type="checkbox" checked={c.demanderUrgence} onChange={(x) => maj(i, { demanderUrgence: x.target.checked })} /> Demander au client si son emploi est menacé (sinon, mise en demeure d&apos;abord)
                      </label>
                    )}
                  </label>
                )}
                <fieldset className="af-c bo-compl">
                  <span>Ajouté au devis</span>
                  {DILIGENCES_COMPLEMENTAIRES.map((dl) => (
                    <label key={dl}>
                      <input
                        type="checkbox"
                        checked={c.complements.includes(dl)}
                        onChange={(x) => maj(i, { complements: x.target.checked ? [...c.complements, dl] : c.complements.filter((y) => y !== dl) })}
                      />{" "}
                      {LIBELLES_DILIGENCE[dl]}
                    </label>
                  ))}
                </fieldset>
              </div>
              <div className="bo-3">
                <label className="af-c">
                  <span>Pièces à réunir (une par ligne)</span>
                  <textarea className="champ" rows={4} value={lignes(c.pieces)} onChange={(x) => maj(i, { pieces: x.target.value.split("\n") })} />
                </label>
                <label className="af-c">
                  <span>Points de vigilance pour l&apos;avocat (un par ligne)</span>
                  <textarea className="champ" rows={4} value={lignes(c.vigilance)} onChange={(x) => maj(i, { vigilance: x.target.value.split("\n") })} />
                </label>
              </div>
              <div className="bo-item-b">
                <label>
                  <input type="checkbox" checked={c.actif} onChange={(x) => maj(i, { actif: x.target.checked })} /> Actif
                </label>
                <button type="button" className="btn sm ghost" disabled={i === 0} onClick={() => setV(v.map((y, j) => (j === i - 1 ? v[i] : j === i ? v[i - 1] : y)))}>
                  Monter
                </button>
                <button type="button" className="btn sm ghost" onClick={() => { setV(v.filter((_, j) => j !== i)); setOuvert(null); }}>
                  Retirer
                </button>
              </div>
            </>
          )}
        </div>
      ))}
      <div className="bo-item-b">
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            setV([...v, { ...CAS_DEFAUT[0], code: `NOUVEAU_CAS_${v.length + 1}`, libelle: "", voieClient: "", signes: "", pieces: [], vigilance: [], complements: [] }]);
            setOuvert(v.length);
          }}
        >
          Ajouter un cas
        </button>
        <button type="button" className="btn sm ghost" onClick={() => setV(CAS_DEFAUT)}>
          Repartir du référentiel intégré
        </button>
      </div>
      <Pied {...e} />
    </form>
  );
}
