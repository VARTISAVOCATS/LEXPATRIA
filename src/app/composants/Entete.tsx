"use client";

// En-têtes de l'interface validée : site public (navigation) et parcours de dépôt (aide, sans porte de sortie).
import Link from "next/link";
import { useState } from "react";
import { ChoixLangue, useT } from "@/i18n/client";
import { useContenus } from "./Contenus";

export function Logo() {
  const t = useT();
  return (
    <Link className="logo" href="/" aria-label={t("Accueil")}>
      <span className="mark" />
      <span>
        <span className="t">LEXPATRIA</span>
        <span className="s">{t("Avocats au barreau de Paris")}</span>
      </span>
    </Link>
  );
}

export function EnteteSite() {
  const t = useT();
  const [menu, setMenu] = useState(false);
  return (
    <>
      <div className="notpref">{t("Lexpatria Avocats, avocats au barreau de Paris. Ce site n'est pas un service de la préfecture ni de l'administration.")}</div>
      <header className="site-h">
        <div className="wrap">
          <Logo />
          <button className="burger" aria-expanded={menu} aria-label={t("Menu")} onClick={() => setMenu(!menu)}>
            ☰
          </button>
          <nav className={`nav ${menu ? "open" : ""}`}>
            <Link href="/honoraires">{t("Honoraires")}</Link>
            <Link href="/cabinet">{t("Le cabinet")}</Link>
            <Link href="/espace">{t("Mon espace")}</Link>
            <ChoixLangue />
          </nav>
        </div>
      </header>
    </>
  );
}

export function EnteteParcours({ langue = false }: { langue?: boolean }) {
  const t = useT();
  const { faq: FAQ } = useContenus();
  const [aide, setAide] = useState(false);
  return (
    <>
      <header className="site-h focus">
        <div className="wrap">
          <Logo />
          <div className="fh-r">
            {langue && <ChoixLangue />}
            <button className="fh-tel fh-help" onClick={() => setAide(true)}>
              <span className="t1">{t("Besoin d'aide ?")}</span>
              <b className="t3">{t("Aide")}</b>
            </button>
          </div>
        </div>
      </header>
      <div className="lx-etat">{t("Cabinet d'avocats — pas un service de l'État")}</div>
      {aide && (
        <div className="overlay" role="dialog" aria-modal onClick={() => setAide(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead">
              <h3>{t("Questions fréquentes")}</h3>
              <button className="btn sm ghost" onClick={() => setAide(false)}>
                {t("Fermer")}
              </button>
            </div>
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{t(f.q)}</summary>
                <p>{t(f.r)}</p>
              </details>
            ))}
            <p className="note">{t("Votre avocat répond par écrit à toute question sur le fond de votre dossier, une fois la procédure engagée.")}</p>
          </div>
        </div>
      )}
    </>
  );
}

/** En-tête des espaces connectés (client ou cabinet) : retour à l'accueil de l'espace, déconnexion. */
export function EnteteEspace({ espace, sousTitre, accueil, connecte, nom }: { espace: "CLIENT" | "EQUIPE"; sousTitre: string; accueil: string; connecte: boolean; nom?: string }) {
  const t = useT();
  return (
    <header className="site-h esp-h">
      <div className="wrap">
        <Link className="logo" href={accueil} aria-label={t(sousTitre)}>
          <span className="mark" />
          <span>
            <span className="t">LEXPATRIA</span>
            <span className="s">{t(sousTitre)}</span>
          </span>
        </Link>
        <div className="esp-h-r">
          {espace === "CLIENT" && <ChoixLangue />}
          {connecte && nom && <span className="esp-nom">{nom}</span>}
          {connecte && (
            <form action={`/api/deconnexion?espace=${espace}`} method="post">
              <button className="btn sm ghost">{t("Se déconnecter")}</button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
