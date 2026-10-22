"use client";
// Petit formulaire générique de l'espace cabinet : envoie ses champs en JSON, puis rafraîchit la page.
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface Champ {
  nom: string;
  type: "date" | "text" | "select" | "textarea";
  label: string;
  options?: [string, string][];
  defaut?: string;
  requis?: boolean;
}

export function ActionForm({
  api = "/api/avocat/action",
  base,
  champs = [],
  libelle,
  classe = "btn sm",
  confirmation,
  enLigne = true,
}: {
  api?: string;
  base: Record<string, unknown>;
  champs?: Champ[];
  libelle: string;
  classe?: string;
  confirmation?: string;
  enLigne?: boolean;
}) {
  const router = useRouter();
  const [valeurs, setValeurs] = useState<Record<string, string>>(Object.fromEntries(champs.map((c) => [c.nom, c.defaut ?? ""])));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aConfirmer, setAConfirmer] = useState(false);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (confirmation && !aConfirmer) return setAConfirmer(true);
    setEnvoi(true);
    setErreur(null);
    const r = await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...base, ...valeurs }) }).catch(() => null);
    setEnvoi(false);
    setAConfirmer(false);
    if (!r?.ok) {
      const j = await r?.json().catch(() => null);
      return setErreur(j?.erreur ?? "L'action a échoué.");
    }
    if (champs.some((c) => c.type === "text" || c.type === "textarea")) setValeurs(Object.fromEntries(champs.map((c) => [c.nom, c.defaut ?? ""])));
    router.refresh();
  }

  return (
    <form className={`af ${enLigne ? "af-l" : ""}`} onSubmit={envoyer}>
      {champs.map((c) => (
        <label key={c.nom} className="af-c">
          <span>{c.label}</span>
          {c.type === "select" ? (
            <select className="champ" value={valeurs[c.nom]} onChange={(e) => setValeurs({ ...valeurs, [c.nom]: e.target.value })} required={c.requis !== false}>
              {c.options?.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          ) : c.type === "textarea" ? (
            <textarea className="champ" rows={4} value={valeurs[c.nom]} onChange={(e) => setValeurs({ ...valeurs, [c.nom]: e.target.value })} required={c.requis !== false} />
          ) : (
            <input className="champ" type={c.type} value={valeurs[c.nom]} onChange={(e) => setValeurs({ ...valeurs, [c.nom]: e.target.value })} required={c.requis !== false} />
          )}
        </label>
      ))}
      <button className={classe} disabled={envoi}>
        {aConfirmer ? `Confirmer : ${libelle.toLowerCase()}` : libelle}
      </button>
      {aConfirmer && (
        <button type="button" className="btn sm ghost" onClick={() => setAConfirmer(false)}>
          Annuler
        </button>
      )}
      {aConfirmer && confirmation && <span className="af-conf">{confirmation}</span>}
      {erreur && <span className="erreur">{erreur}</span>}
    </form>
  );
}
