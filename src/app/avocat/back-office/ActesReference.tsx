"use client";
// Back office › Modèles d'actes › Actes de référence : l'associé dépose des actes déjà rédigés par le cabinet.
// L'IA s'en inspire (structure, style, moyens) pour préparer les projets du même type, sans en reprendre les faits.
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ActeReferenceBO {
  id: string;
  code: string;
  titre: string;
  fichier: string | null;
  actif: boolean;
  le: string;
  longueur: number;
}

export default function ActesReference({ actes, types }: { actes: ActeReferenceBO[]; types: [string, string][] }) {
  const router = useRouter();
  const [code, setCode] = useState(types[0]?.[0] ?? "");
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [fichier, setFichier] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const libelle = new Map(types);

  async function importer(f: File) {
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    const fd = new FormData();
    fd.append("fichier", f);
    const r = await fetch("/api/backoffice/actes-reference", { method: "POST", body: fd }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnvoi(false);
    if (!r?.ok) return setErreur(j.erreur ?? "Import impossible.");
    setTexte(j.texte);
    setFichier(j.fichier);
    if (!titre) setTitre(j.fichier.replace(/\.(docx|pdf|txt)$/i, ""));
    setInfo("Texte importé. Les e-mails, téléphones et numéros ont été remplacés par XXX : vérifiez qu'aucun nom ni aucune adresse du client ne subsiste, puis enregistrez.");
  }

  async function poster(corps: object, message: string) {
    setEnvoi(true);
    setErreur(null);
    const r = await fetch("/api/backoffice/actes-reference", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnvoi(false);
    if (!r?.ok) {
      setErreur(j.erreur ?? "Opération impossible.");
      return false;
    }
    setInfo(message);
    router.refresh();
    return true;
  }

  return (
    <section className="card bo-ref">
      <h2>Actes de référence</h2>
      <p className="note">
        Déposez des actes que le cabinet a déjà rédigés. Pour chaque projet du même type, l&apos;IA s&apos;inspire des deux plus récents : plan, style,
        formulations et moyens. Elle n&apos;en reprend jamais les faits.
      </p>

      <div className="bo-grille">
        <label>
          Type d&apos;acte
          <select className="champ" value={code} onChange={(e) => setCode(e.target.value)}>
            {types.map(([c, l]) => (
              <option key={c} value={c}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Titre (pour vous repérer)
          <input className="champ" value={titre} maxLength={160} placeholder="Requête OQTF, vie privée et familiale" onChange={(e) => setTitre(e.target.value)} />
        </label>
      </div>
      <label className="btn sm ghost mo-import">
        {envoi ? "Lecture du fichier…" : "Importer un acte (Word, PDF ou texte)"}
        <input type="file" accept=".docx,.pdf,.txt" hidden disabled={envoi} onChange={(e) => e.target.files?.[0] && importer(e.target.files[0])} />
      </label>
      <textarea
        className="bo-ref-texte"
        value={texte}
        placeholder="Importez un fichier ou collez ici le texte d'un acte déjà rédigé (noms et adresses du client remplacés par XXX)."
        onChange={(e) => setTexte(e.target.value)}
      />
      {erreur && <p className="erreur">{erreur}</p>}
      {info && <p className="note ok">{info}</p>}
      <div className="actions">
        <button
          className="btn cta sm"
          disabled={envoi || texte.trim().length < 300}
          onClick={async () => {
            if (await poster({ action: "ajouter", code, titre, texte, fichier }, "Acte de référence enregistré : il servira aux prochains projets de ce type.")) {
              setTexte("");
              setTitre("");
              setFichier(null);
            }
          }}
        >
          Enregistrer comme référence
        </button>
      </div>

      <h3>Actes enregistrés</h3>
      {actes.length === 0 ? (
        <p className="note">Aucun acte de référence pour le moment.</p>
      ) : (
        <div className="bo-ref-liste">
          {actes.map((a) => (
            <div key={a.id} className={`bo-ref-l ${a.actif ? "" : "off"}`}>
              <span>
                <b>{a.titre}</b>
                <small>
                  {libelle.get(a.code) ?? a.code} · {a.le} · {Math.round(a.longueur / 1000)} k caractères{a.fichier ? ` · ${a.fichier}` : ""}
                  {a.actif ? "" : " · retiré"}
                </small>
              </span>
              <span className="bo-ref-b">
                <button className="btn sm ghost" disabled={envoi} onClick={() => poster({ action: "activer", id: a.id, actif: !a.actif }, a.actif ? "Acte retiré des références." : "Acte remis en référence.")}>
                  {a.actif ? "Retirer" : "Remettre"}
                </button>
                {aSupprimer === a.id ? (
                  <>
                    <button className="btn sm" disabled={envoi} onClick={async () => (await poster({ action: "supprimer", id: a.id }, "Acte supprimé.")) && setASupprimer(null)}>
                      Supprimer définitivement
                    </button>
                    <button className="btn sm ghost" onClick={() => setASupprimer(null)}>
                      Annuler
                    </button>
                  </>
                ) : (
                  <button className="btn sm ghost" onClick={() => setASupprimer(a.id)}>
                    Supprimer
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
