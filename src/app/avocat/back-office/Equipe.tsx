"use client";
// Back office › Équipe : fiche complète de chaque membre (identité, qualité, rémunération, attribution, compte).
// La qualité fixe le rôle sur la plateforme : associé, collaborateur ou sous-traitant (avocats), secrétariat, confrère local.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CODES_QUALITE, MODE_PAR_DEFAUT, MODES_REMUNERATION, QUALITES, VALEURS_CABINET, type ModeRemuneration, type Qualite } from "@/lib/equipe";

export interface MembreBO {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  qualite: Qualite;
  titre: string;
  barreau: string;
  mobile: string;
  photoUrl: string;
  remuneration: ModeRemuneration;
  fixeMensuel: number | null; // euros HT
  seuilVariable: number | null;
  tauxVariable: number | null; // %
  acte: number | null;
  avis: number | null;
  validationAssocie: boolean;
  attributionOuverte: boolean;
  actif: boolean;
  moi: boolean;
}

const VIDE: Omit<MembreBO, "id" | "actif" | "moi"> & { id?: string } = {
  prenom: "",
  nom: "",
  email: "",
  qualite: "COLLABORATEUR",
  titre: "",
  barreau: "Paris",
  mobile: "",
  photoUrl: "",
  remuneration: "COLLABORATEUR_FIXE_VARIABLE",
  fixeMensuel: null,
  seuilVariable: null,
  tauxVariable: null,
  acte: null,
  avis: null,
  validationAssocie: false,
  attributionOuverte: true,
};

const eur = (v: number) => `${v.toLocaleString("fr-FR")} €`;

function resumeRemuneration(u: MembreBO, acteCabinet: number) {
  const V = VALEURS_CABINET;
  if (u.remuneration === "COLLABORATEUR_FIXE_VARIABLE")
    return `Fixe ${eur(u.fixeMensuel ?? V.fixeMensuelHT / 100)} HT, ${u.tauxVariable ?? V.tauxVariable * 100} % au-delà de ${eur(u.seuilVariable ?? V.seuilVariableHT / 100)} HT`;
  if (u.remuneration === "A_L_ACTE") return `${eur(u.acte ?? acteCabinet / 100)} HT par acte, ${eur(u.avis ?? V.avisHT / 100)} HT par avis`;
  return "Aucune";
}

export default function Equipe({ membres, acteCabinet }: { membres: MembreBO[]; acteCabinet: number }) {
  const router = useRouter();
  const [fiche, setFiche] = useState<typeof VIDE | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [aDesactiver, setADesactiver] = useState<string | null>(null);
  const moi = membres.find((u) => u.moi);

  async function poster(corps: object, message: string) {
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    const r = await fetch("/api/backoffice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnvoi(false);
    if (!r?.ok) {
      setErreur(j.erreur ?? "Enregistrement impossible.");
      return false;
    }
    setInfo(message);
    router.refresh();
    return true;
  }

  const maj = (champs: Partial<typeof VIDE>) => setFiche((f) => (f ? { ...f, ...champs } : f));
  const nombre = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

  return (
    <section className="card bo-equipe">
      <div className="bo-eq-tete">
        <h2>Équipe</h2>
        <button className="btn sm cta" onClick={() => setFiche({ ...VIDE })}>
          Ajouter un membre
        </button>
      </div>
      {info && !fiche && <p className="note ok">{info}</p>}

      <div className="bo-eq-liste">
        {membres.map((u) => (
          <div key={u.id} className={`bo-eq-m ${u.actif ? "" : "off"}`}>
            <div className="bo-eq-id">
              <b>
                {u.prenom} {u.nom}
                {u.moi ? " (vous)" : ""}
              </b>
              <span>
                {QUALITES[u.qualite].libelle}
                {u.titre ? ` · ${u.titre}` : ""}
              </span>
              <small>{u.email}</small>
            </div>
            <div className="bo-eq-rem">
              <span>{resumeRemuneration(u, acteCabinet)}</span>
              <small>
                {u.actif ? (u.attributionOuverte ? "Reçoit des dossiers" : "Attribution suspendue") : "Compte désactivé"}
                {u.validationAssocie ? " · actes validés par un associé" : ""}
              </small>
            </div>
            <div className="bo-eq-act">
              <button
                className="btn sm ghost"
                onClick={() => {
                  const { actif: _a, moi: _m, ...reste } = u;
                  setFiche(reste);
                  setErreur(null);
                  setInfo(null);
                }}
              >
                Modifier
              </button>
              {!u.moi &&
                (aDesactiver === u.id ? (
                  <>
                    <button className="btn sm" disabled={envoi} onClick={async () => (await poster({ action: "membreActif", id: u.id, actif: false }, "Compte désactivé.")) && setADesactiver(null)}>
                      Confirmer
                    </button>
                    <button className="btn sm ghost" onClick={() => setADesactiver(null)}>
                      Annuler
                    </button>
                  </>
                ) : (
                  <button
                    className="btn sm ghost"
                    disabled={envoi}
                    onClick={() => (u.actif ? setADesactiver(u.id) : poster({ action: "membreActif", id: u.id, actif: true }, "Compte réactivé."))}
                  >
                    {u.actif ? "Désactiver" : "Réactiver"}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      {aDesactiver && <p className="note">Le compte ne pourra plus se connecter ni recevoir de dossiers. Ses dossiers en cours restent dans le cabinet.</p>}

      {fiche && (
        <div className="bo-fiche">
          <h3>{fiche.id ? `Fiche de ${fiche.prenom} ${fiche.nom}` : "Nouveau membre"}</h3>

          <fieldset>
            <legend>Identité</legend>
            <div className="bo-grille">
              <label>
                Prénom
                <input className="champ" value={fiche.prenom} onChange={(e) => maj({ prenom: e.target.value })} />
              </label>
              <label>
                Nom
                <input className="champ" value={fiche.nom} onChange={(e) => maj({ nom: e.target.value })} />
              </label>
              <label>
                E-mail professionnel (connexion)
                <input className="champ" type="email" value={fiche.email} onChange={(e) => maj({ email: e.target.value })} />
              </label>
              <label>
                Mobile
                <input className="champ" type="tel" value={fiche.mobile} onChange={(e) => maj({ mobile: e.target.value })} />
              </label>
              <label>
                Titre affiché
                <input className="champ" value={fiche.titre} placeholder="Docteur en droit" onChange={(e) => maj({ titre: e.target.value })} />
              </label>
              <label>
                Barreau
                <input className="champ" value={fiche.barreau} onChange={(e) => maj({ barreau: e.target.value })} />
              </label>
              <label className="large">
                Photo (adresse de l&apos;image sur le site)
                <input className="champ" value={fiche.photoUrl} placeholder="/avocats/prenom-nom.jpg" onChange={(e) => maj({ photoUrl: e.target.value })} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Qualité au cabinet</legend>
            <div className="bo-choix">
              {CODES_QUALITE.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={fiche.qualite === q ? "on" : ""}
                  disabled={fiche.id === moi?.id && q !== "ASSOCIE"}
                  onClick={() => maj({ qualite: q, remuneration: MODE_PAR_DEFAUT[q] })}
                >
                  {QUALITES[q].libelle}
                </button>
              ))}
            </div>
            <p className="note">
              {fiche.qualite === "ASSOCIE" && "Accès à tous les dossiers, au back office et aux chiffres du cabinet."}
              {(fiche.qualite === "COLLABORATEUR" || fiche.qualite === "SOUS_TRAITANT") && "Voit ses seuls dossiers et les éléments financiers qui le concernent."}
              {fiche.qualite === "SECRETARIAT" && "Dépôts Télérecours, appels aux clients, relances de pièces. Ne rédige ni n'envoie d'avis."}
              {fiche.qualite === "CONFRERE_LOCAL" && "Plaide hors Île-de-France pour le cabinet ; ne reçoit pas de dossiers à rédiger."}
            </p>
          </fieldset>

          <fieldset>
            <legend>Rémunération</legend>
            <select className="champ" value={fiche.remuneration} onChange={(e) => maj({ remuneration: e.target.value as ModeRemuneration })}>
              {(Object.keys(MODES_REMUNERATION) as ModeRemuneration[]).map((k) => (
                <option key={k} value={k}>
                  {MODES_REMUNERATION[k]}
                </option>
              ))}
            </select>
            {fiche.remuneration === "COLLABORATEUR_FIXE_VARIABLE" && (
              <div className="bo-grille">
                <label>
                  Fixe mensuel (€ HT)
                  <input className="champ" inputMode="decimal" value={fiche.fixeMensuel ?? ""} placeholder={String(VALEURS_CABINET.fixeMensuelHT / 100)} onChange={(e) => maj({ fixeMensuel: nombre(e.target.value) })} />
                </label>
                <label>
                  Seuil mensuel (€ HT)
                  <input className="champ" inputMode="decimal" value={fiche.seuilVariable ?? ""} placeholder={String(VALEURS_CABINET.seuilVariableHT / 100)} onChange={(e) => maj({ seuilVariable: nombre(e.target.value) })} />
                </label>
                <label>
                  Pourcentage au-delà du seuil (%)
                  <input className="champ" inputMode="decimal" value={fiche.tauxVariable ?? ""} placeholder={String(VALEURS_CABINET.tauxVariable * 100)} onChange={(e) => maj({ tauxVariable: nombre(e.target.value) })} />
                </label>
                <p className="note large">Base : honoraires HT encaissés sur ses dossiers, hors avis et consultations, calculée chaque mois.</p>
              </div>
            )}
            {fiche.remuneration === "A_L_ACTE" && (
              <div className="bo-grille">
                <label>
                  Par acte (€ HT)
                  <input className="champ" inputMode="decimal" value={fiche.acte ?? ""} placeholder={String(acteCabinet / 100)} onChange={(e) => maj({ acte: nombre(e.target.value) })} />
                </label>
                <label>
                  Par avis ou consultation (€ HT)
                  <input className="champ" inputMode="decimal" value={fiche.avis ?? ""} placeholder={String(VALEURS_CABINET.avisHT / 100)} onChange={(e) => maj({ avis: nombre(e.target.value) })} />
                </label>
                <p className="note large">Un acte compte une fois, à sa première attestation. Laissez vide pour appliquer le montant du cabinet.</p>
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend>Dossiers</legend>
            <label className="chk">
              <input type="checkbox" checked={fiche.attributionOuverte} onChange={(e) => maj({ attributionOuverte: e.target.checked })} />
              Reçoit de nouveaux dossiers (attribution automatique)
            </label>
            <label className="chk">
              <input type="checkbox" checked={fiche.validationAssocie} onChange={(e) => maj({ validationAssocie: e.target.checked })} />
              Ses actes sont validés par un associé avant dépôt
            </label>
          </fieldset>

          {erreur && <p className="erreur">{erreur}</p>}
          <div className="actions">
            <button className="btn ghost" onClick={() => setFiche(null)}>
              Fermer
            </button>
            <button
              className="btn cta"
              disabled={envoi || !fiche.prenom.trim() || !fiche.nom.trim() || !/\S+@\S+\.\S+/.test(fiche.email)}
              onClick={async () => {
                if (await poster({ action: "fiche", ...fiche }, "Fiche enregistrée.")) setFiche(null);
              }}
            >
              {envoi ? "Enregistrement…" : "Enregistrer la fiche"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
