"use client";
// Back office › Modèles d'actes : l'associé dépose (Word) ou rédige le modèle du cabinet pour chaque type d'acte.
// Les variables {{…}} sont remplies avec les données du dossier ; une donnée absente devient XXX, surligné en jaune.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface EtatModele {
  code: string;
  libelle: string;
  cabinet: boolean;
  texte: string;
  versions: { id: string; version: number; le: string; fichier: string | null; vide: boolean }[];
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

export default function Modeles({ modeles, variables }: { modeles: EtatModele[]; variables: { nom: string; libelle: string }[] }) {
  const router = useRouter();
  const [code, setCode] = useState(modeles[0]?.code ?? "");
  const actuel = modeles.find((m) => m.code === code)!;
  const [texte, setTexte] = useState(actuel?.texte ?? "");
  const [fichier, setFichier] = useState<string | null>(null);
  const [apercu, setApercu] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const zone = useRef<HTMLTextAreaElement>(null);
  const modifie = texte !== (actuel?.texte ?? "");

  useEffect(() => {
    setTexte(actuel?.texte ?? "");
    setFichier(null);
    setErreur(null);
    setInfo(null);
  }, [code, actuel?.texte]);

  // Aperçu avec un dossier fictif, recalculé après une courte pause de frappe.
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await fetch("/api/backoffice/modeles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "apercu", code, texte }) }).catch(() => null);
      const j = await r?.json().catch(() => null);
      if (j?.apercu !== undefined) setApercu(j.apercu);
    }, 400);
    return () => clearTimeout(t);
  }, [code, texte]);

  const inconnues = useMemo(() => {
    const connues = new Set(variables.map((v) => v.nom));
    return [...new Set([...texte.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((m) => m[1]).filter((n) => !connues.has(n)))];
  }, [texte, variables]);

  function inserer(nom: string) {
    const z = zone.current;
    const jeton = `{{${nom}}}`;
    if (!z) return setTexte(texte + jeton);
    const a = z.selectionStart ?? texte.length;
    const b = z.selectionEnd ?? a;
    setTexte(texte.slice(0, a) + jeton + texte.slice(b));
    requestAnimationFrame(() => {
      z.focus();
      z.selectionStart = z.selectionEnd = a + jeton.length;
    });
  }

  async function importer(f: File) {
    setErreur(null);
    const fd = new FormData();
    fd.append("fichier", f);
    const r = await fetch("/api/backoffice/modeles", { method: "POST", body: fd }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok) return setErreur(j?.erreur ?? "Import impossible.");
    setTexte(j.texte);
    setFichier(j.fichier);
    setInfo(`« ${j.fichier} » importé : relisez le texte, placez les variables, puis enregistrez.`);
  }

  async function poster(corps: object, message: string) {
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    const r = await fetch("/api/backoffice/modeles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setEnvoi(false);
    if (!r?.ok) return setErreur(j?.erreur ?? "L'enregistrement a échoué.");
    setInfo(message);
    router.refresh();
  }

  if (!actuel) return null;
  return (
    <div className="mo">
      <section className="card">
        <div className="cab-barre">
          <label className="af-c">
            <span>Type d&apos;acte</span>
            <select className="champ" value={code} onChange={(e) => setCode(e.target.value)}>
              {modeles.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.libelle}
                  {m.cabinet ? " — modèle du cabinet" : ""}
                </option>
              ))}
            </select>
          </label>
          <span className={`pill ${actuel.cabinet ? "ok" : "n"}`}>{actuel.cabinet ? `Modèle du cabinet, version ${actuel.versions[0]?.version}` : "Modèle intégré à la plateforme"}</span>
        </div>
        <p className="note">
          Déposez votre modèle Word ou rédigez-le ici. Placez les variables là où les données du dossier doivent apparaître ; ce qui reste à compléter s&apos;écrit XXX. Le modèle
          s&apos;applique aux projets générés ensuite ; les projets existants ne changent pas.
        </p>
        <div className="cab-actions">
          <label className="btn sm ghost mo-import">
            Importer un fichier Word (.docx)
            <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={(e) => e.target.files?.[0] && importer(e.target.files[0])} />
          </label>
          {actuel.cabinet && (
            <button className="btn sm ghost" disabled={envoi} onClick={() => poster({ action: "enregistrer", code, texte: "" }, "Le modèle intégré s'applique de nouveau.")}>
              Revenir au modèle intégré
            </button>
          )}
        </div>
      </section>

      <div className="mo-grille">
        <section className="card">
          <h2>Modèle du cabinet</h2>
          <textarea
            ref={zone}
            className="champ mo-texte"
            rows={26}
            value={texte}
            placeholder="Aucun modèle du cabinet : le modèle intégré s'applique (voir l'aperçu). Importez votre fichier Word ou rédigez ici."
            onChange={(e) => setTexte(e.target.value)}
            spellCheck
          />
          {inconnues.length > 0 && <p className="erreur">Variable(s) inconnue(s) : {inconnues.map((x) => `{{${x}}}`).join(", ")}</p>}
          <div className="cab-actions">
            <button className="btn cta sm" disabled={envoi || !modifie || !texte.trim() || inconnues.length > 0} onClick={() => poster({ action: "enregistrer", code, texte, fichier }, "Modèle enregistré : il s'applique aux prochains projets.")}>
              Enregistrer le modèle
            </button>
            {modifie && (
              <button className="btn sm ghost" onClick={() => setTexte(actuel.texte)}>
                Annuler les modifications
              </button>
            )}
          </div>
          {info && <p className="note">{info}</p>}
          {erreur && <p className="erreur">{erreur}</p>}
        </section>

        <aside className="card mo-vars">
          <h2>Variables</h2>
          <p className="note">Cliquez pour insérer à l&apos;endroit du curseur.</p>
          <ul>
            {variables.map((v) => (
              <li key={v.nom}>
                <button type="button" className="mo-var" onClick={() => inserer(v.nom)}>
                  {`{{${v.nom}}}`}
                </button>
                <span>{v.libelle}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="card">
        <h2>Aperçu avec un dossier fictif</h2>
        <Surligne texte={apercu} />
      </section>

      {actuel.versions.length > 0 && (
        <section className="card">
          <h2>Versions</h2>
          <ul className="esp-lignes">
            {actuel.versions.map((v, i) => (
              <li key={v.id}>
                <span>
                  Version {v.version} · {v.le}
                  {v.fichier ? ` · ${v.fichier}` : ""}
                  {v.vide ? " · retour au modèle intégré" : ""}
                </span>
                {i === 0 ? (
                  <span className="pill ok">en vigueur</span>
                ) : (
                  <button className="btn sm ghost" disabled={envoi} onClick={() => poster({ action: "restaurer", id: v.id }, `Version ${v.version} rétablie.`)}>
                    Rétablir
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
