"use client";
// Éditeurs des contenus du back office. Chaque enregistrement passe par le filtre déontologique et l'historique.
import { useState } from "react";
import { useRouter } from "next/navigation";

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
