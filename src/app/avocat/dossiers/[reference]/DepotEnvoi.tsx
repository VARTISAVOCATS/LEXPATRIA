"use client";
// Après l'attestation : envoi en recommandé (Maileva) ou préparation du dépôt Télérecours, puis numéro de requête.
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ProprietesDepot {
  reference: string;
  mode: "COURRIER" | "TELERECOURS";
  atteste: boolean;
  libelleActe: string;
  adresse: string;
  envois: { id: string; statut: string; destinataire: string; le: string; message: string | null }[];
  numeroRequete: string | null;
  statut: string;
  mailevaConfigure: boolean;
}

const LIB_ENVOI: Record<string, string> = { SIMULE: "simulé", ENVOYE: "envoyé", DISTRIBUE: "distribué", ERREUR: "en erreur" };

export default function DepotEnvoi(p: ProprietesDepot) {
  const router = useRouter();
  const [adresse, setAdresse] = useState(p.adresse);
  const [numero, setNumero] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [envoi, setEnvoi] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function agir(corps: object) {
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    const r = await fetch("/api/avocat/integrations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference: p.reference, ...corps }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setEnvoi(false);
    setConfirmer(false);
    if (!r?.ok) return setErreur(j?.erreur ?? "L'action a échoué.");
    if (j?.simule) setInfo("Envoi simulé : aucun courrier réel n'est parti (Maileva non configuré ou en environnement de test).");
    router.refresh();
  }

  const dejaEnvoye = p.envois.some((e) => e.statut !== "ERREUR");

  return (
    <section className="card">
      <h2>{p.mode === "COURRIER" ? "Envoi en recommandé (Maileva)" : "Dépôt Télérecours"}</h2>
      {!p.atteste ? (
        <p className="note">Disponible dès que la dernière version de l&apos;acte est attestée.</p>
      ) : p.mode === "COURRIER" ? (
        <>
          <p className="note">
            {p.libelleActe} envoyé(e) en lettre recommandée avec avis de réception, à partir de la version attestée (PDF). Le dossier passe ensuite à « Recours déposé ».
            {!p.mailevaConfigure && " Maileva n'est pas encore configuré : l'envoi sera simulé."}
          </p>
          {!dejaEnvoye && (
            <>
              <label className="af-c">
                <span>Destinataire (une ligne par ligne d&apos;adresse, 6 au plus)</span>
                <textarea className="champ" rows={5} value={adresse} onChange={(e) => setAdresse(e.target.value)} />
              </label>
              <div className="cab-actions">
                <button className="btn cta sm" disabled={envoi || !adresse.trim() || /XXX/.test(adresse)} onClick={() => (confirmer ? agir({ action: "recommande", adresse }) : setConfirmer(true))}>
                  {confirmer ? "Confirmer l'envoi du recommandé" : "Envoyer en recommandé"}
                </button>
                {confirmer && (
                  <button className="btn sm ghost" onClick={() => setConfirmer(false)}>
                    Annuler
                  </button>
                )}
                {/XXX/.test(adresse) && <span className="pill warn">Adresse à compléter</span>}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p className="note">
            Télérecours n&apos;offre pas d&apos;interface de dépôt automatique : téléchargez l&apos;archive (requête attestée et pièces numérotées en PDF, nommées pour l&apos;inventaire
            automatique), déposez-la dans Télérecours, puis indiquez ici le numéro attribué par la juridiction.
          </p>
          <div className="cab-actions">
            <a className="btn sm" href={`/api/avocat/telerecours/${p.reference}`}>
              Télécharger l&apos;archive Télérecours
            </a>
          </div>
          {p.numeroRequete ? (
            <p className="box">Requête enregistrée sous le n° {p.numeroRequete}.</p>
          ) : (
            <div className="af af-l">
              <label className="af-c">
                <span>N° de requête</span>
                <input className="champ" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="2601234" />
              </label>
              <label className="af-c">
                <span>Enregistrée le</span>
                <input className="champ" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <button className="btn sm" disabled={envoi || numero.trim().length < 5} onClick={() => agir({ action: "enregistrement", numero, date })}>
                Enregistrer le numéro
              </button>
            </div>
          )}
        </>
      )}
      {p.envois.length > 0 && (
        <ul className="esp-lignes">
          {p.envois.map((e) => (
            <li key={e.id}>
              <span>
                {e.le} · {e.destinataire.split("\n")[0]}
                {e.message ? ` · ${e.message}` : ""}
              </span>
              <span className={`pill ${e.statut === "ERREUR" ? "bad" : e.statut === "SIMULE" ? "warn" : "ok"}`}>{LIB_ENVOI[e.statut] ?? e.statut}</span>
            </li>
          ))}
        </ul>
      )}
      {info && <p className="note">{info}</p>}
      {erreur && <p className="erreur">{erreur}</p>}
    </section>
  );
}
