// Éléments communs des pages publiques : bandeau d'ouverture, visages et cartes des avocats, bande de fin.
// Une même allure partout : sobre, chaleureuse, rassurante.
import type { ReactNode } from "react";
import BoutonsAccueil from "../BoutonsAccueil";

type T = (texte: string, vars?: Record<string, string | number>) => string;
export interface Avocat {
  nom: string;
  titre: string;
  photo: string | null;
}

const initiales = (nom: string) =>
  nom
    .replace(/^Me\s+/, "")
    .split(/\s+/)
    .map((x) => x[0])
    .join("")
    .slice(0, 2);

export function Visage({ nom, photo }: Avocat | { nom: string; photo: string | null }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" />
  ) : (
    <span>{initiales(nom)}</span>
  );
}

export function Visages({ avocats, petit }: { avocats: Avocat[]; petit?: boolean }) {
  return (
    <div className={`acc-visages${petit ? " pv-petit" : ""}`} aria-hidden>
      {avocats.map((a) => (
        <span key={a.nom} className="acc-v">
          <Visage nom={a.nom} photo={a.photo} />
        </span>
      ))}
    </div>
  );
}

export function CartesAvocats({ avocats, t }: { avocats: Avocat[]; t: T }) {
  return (
    <div className="acc-avocats">
      {avocats.map((a) => (
        <figure key={a.nom} className="acc-av">
          <div className="acc-av-ph">
            <Visage nom={a.nom} photo={a.photo} />
          </div>
          <figcaption>
            <b>{a.nom}</b>
            {t(a.titre)
              .split(" · ")
              .map((l) => (
                <span key={l}>{l}</span>
              ))}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Bandeau d'ouverture d'une page : surtitre, titre, chapô ; à droite, un encart facultatif. */
export function Bandeau({ surtitre, titre, chapo, aside, children }: { surtitre: string; titre: string; chapo?: string; aside?: ReactNode; children?: ReactNode }) {
  return (
    <section className="acc-hero pg-hero">
      <div className={`wrap ${aside ? "acc-hero-g" : "pg-hero-s"}`}>
        <div className="acc-hero-t">
          <p className="acc-eye">{surtitre}</p>
          <h1>{titre}</h1>
          {chapo && <p className="acc-sub">{chapo}</p>}
          {children}
        </div>
        {aside}
      </div>
    </section>
  );
}

/** Encart sombre : les visages des avocats et un mot du cabinet. */
export function MotCabinet({ avocats, texte }: { avocats: Avocat[]; texte: string }) {
  return (
    <aside className="acc-mot">
      <Visages avocats={avocats} />
      <blockquote>{texte}</blockquote>
    </aside>
  );
}

/** Bande de fin : une phrase qui rassure, puis les deux façons d'agir. */
export function BandeFin({ titre, texte }: { titre: string; texte: string }) {
  return (
    <section className="acc-fin">
      <h2>{titre}</h2>
      <p>{texte}</p>
      <div className="h-cta ph-cta">
        <BoutonsAccueil />
      </div>
    </section>
  );
}
