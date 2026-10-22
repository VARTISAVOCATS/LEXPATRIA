"use client";
// Rubrique « Connexions » : saisie des clés d'API (champs masqués, jamais réaffichés) et essai de connexion.
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface EtatChamp {
  nom: string;
  libelle: string;
  secret: boolean;
  requis?: boolean;
  source: "back office" | "fichier .env" | null;
  apercu: string | null;
}

export function FormConnexion({ service, champs, testable }: { service: string; champs: EtatChamp[]; testable: boolean }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [v, setV] = useState<Record<string, string>>({});
  const [etat, setEtat] = useState<{ envoi: boolean; erreur?: string; info?: string; ok?: boolean }>({ envoi: false });

  async function poster(corps: object) {
    setEtat({ envoi: true });
    const r = await fetch("/api/backoffice/connexions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    return { ok: !!r?.ok, j };
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    const { ok, j } = await poster({ action: "enregistrer", service, valeurs: v });
    if (!ok) return setEtat({ envoi: false, erreur: j?.erreur ?? "Échec de l'enregistrement." });
    setV({});
    setOuvert(false);
    setEtat({ envoi: false, info: "Enregistré. Les clés sont chiffrées et ne seront plus affichées." });
    router.refresh();
  }

  async function tester() {
    const { j } = await poster({ action: "tester", service });
    setEtat({ envoi: false, ok: j?.ok, info: j?.message ?? "Essai impossible." });
    router.refresh();
  }

  return (
    <div className="cx-zone">
      <div className="bo-pied">
        <button type="button" className="btn sm" onClick={() => setOuvert(!ouvert)}>
          {ouvert ? "Fermer" : "Saisir ou modifier les clés"}
        </button>
        {testable && (
          <button type="button" className="btn sm ghost" disabled={etat.envoi} onClick={tester}>
            {etat.envoi ? "Essai…" : "Tester la connexion"}
          </button>
        )}
        {etat.info && <span className={`pill ${etat.ok === false ? "bad" : etat.ok ? "ok" : "n"}`}>{etat.info}</span>}
        {etat.erreur && <span className="erreur">{etat.erreur}</span>}
      </div>
      {ouvert && (
        <form onSubmit={enregistrer} className="cx-champs" autoComplete="off">
          {champs.map((c) => (
            <label key={c.nom} className="af-c">
              <span>
                {c.libelle}
                {c.requis ? " *" : ""}
              </span>
              <input
                className="champ"
                type={c.secret ? "password" : "text"}
                autoComplete={c.secret ? "new-password" : "off"}
                spellCheck={false}
                placeholder={c.apercu ? `Actuelle : ${c.apercu} — laisser vide pour ne pas changer` : "Non renseignée"}
                value={v[c.nom] ?? ""}
                onChange={(e) => setV({ ...v, [c.nom]: e.target.value })}
              />
              {c.source === "back office" && (
                <button type="button" className="lien-mini" onClick={() => setV({ ...v, [c.nom]: "__effacer__" })}>
                  {v[c.nom] === "__effacer__" ? "Sera effacée à l'enregistrement" : "Effacer la valeur du back office"}
                </button>
              )}
            </label>
          ))}
          <div className="bo-pied">
            <button className="btn cta sm" disabled={etat.envoi || !Object.values(v).some(Boolean)}>
              Enregistrer
            </button>
            <span className="note">Saisissez les clés ici, directement : ne les envoyez jamais par e-mail ou par message.</span>
          </div>
        </form>
      )}
    </div>
  );
}
