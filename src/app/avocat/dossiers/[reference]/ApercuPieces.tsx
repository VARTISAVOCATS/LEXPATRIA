"use client";
// Pièces du dossier à portée de main dans le poste de travail : liste compacte et aperçu dans un panneau latéral,
// sans quitter le projet d'acte (photos et PDF affichés directement, autres formats ouverts dans un onglet).
import { useCallback, useEffect, useMemo, useState } from "react";

export interface PieceApercu {
  id: string;
  libelle: string;
  fichiers: { i: number; nom: string; mime: string }[];
}

export default function ApercuPieces({ pieces }: { pieces: PieceApercu[] }) {
  const tous = useMemo(() => pieces.flatMap((p) => p.fichiers.map((f) => ({ ...f, pieceId: p.id, libelle: p.libelle, url: `/api/fichier?piece=${p.id}&i=${f.i}` }))), [pieces]);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const courant = ouvert === null ? null : tous[ouvert];
  const aller = useCallback((pas: number) => setOuvert((o) => (o === null ? o : (o + pas + tous.length) % tous.length)), [tous.length]);

  useEffect(() => {
    if (ouvert === null) return;
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(null);
      if (e.key === "ArrowRight" && e.altKey) aller(1);
      if (e.key === "ArrowLeft" && e.altKey) aller(-1);
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [ouvert, aller]);

  return (
    <section className="card pt-pieces">
      <h2>Pièces du dossier</h2>
      {tous.length === 0 ? (
        <p className="note">Aucune pièce transmise pour l&apos;instant.</p>
      ) : (
        <ul>
          {tous.map((f, k) => (
            <li key={`${f.pieceId}-${f.i}`}>
              <button type="button" className={ouvert === k ? "on" : ""} onClick={() => setOuvert(k)} title={f.nom}>
                <span className="pt-pieces-l">{f.libelle}</span>
                <span className="pt-pieces-n">{f.nom}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {courant && (
        <div className="pt-visu" role="dialog" aria-label={`Aperçu : ${courant.libelle}`}>
          <div className="pt-visu-tete">
            <div>
              <b>{courant.libelle}</b>
              <span>
                {courant.nom} · {ouvert! + 1} / {tous.length}
              </span>
            </div>
            <div className="pt-visu-act">
              <button type="button" className="btn sm ghost" onClick={() => aller(-1)} disabled={tous.length < 2} aria-label="Pièce précédente">
                ‹
              </button>
              <button type="button" className="btn sm ghost" onClick={() => aller(1)} disabled={tous.length < 2} aria-label="Pièce suivante">
                ›
              </button>
              <a className="btn sm ghost" href={courant.url} target="_blank" rel="noreferrer">
                Ouvrir dans un onglet
              </a>
              <button type="button" className="btn sm" onClick={() => setOuvert(null)}>
                Fermer
              </button>
            </div>
          </div>
          <div className="pt-visu-corps">
            {courant.mime.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={courant.url} alt={courant.libelle} />
            ) : courant.mime === "application/pdf" ? (
              <iframe src={courant.url} title={courant.libelle} />
            ) : (
              <p className="note">
                Ce format ne s&apos;affiche pas dans l&apos;aperçu.{" "}
                <a href={courant.url} target="_blank" rel="noreferrer">
                  Ouvrir le fichier
                </a>
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
