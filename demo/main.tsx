// Démonstration autonome de la plateforme LEXPATRIA (sans serveur) : mêmes écrans et mêmes règles que la plateforme.
import { Component, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../src/app/interface.css";
import "../src/app/globals.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/spectral/500.css";
import "@fontsource/spectral/600.css";
import "@fontsource/spectral/700.css";
import { sens, type Langue } from "../src/i18n";
import { AVOCATS, FAQ } from "../src/lib/accueil";
import { parSlug, SITUATIONS, type Bloc } from "../src/lib/situations";
import BoutonsAccueil from "../src/app/BoutonsAccueil";
import Parcours from "../src/app/depot/Parcours";
import Link from "./shims/next-link";
import { FournisseurLangue, useT } from "./shims/i18n-client";
import { EnteteParcours, EnteteSite } from "../src/app/composants/Entete";
import PiedSite from "../src/app/composants/PiedSite";
import { formatEuros, TARIFS_DEFAUT } from "../src/lib/procedures";
import { naviguer, ouvrirEspace, useChemin } from "./navigation";
import { AVOCAT_DEMO, dossierDemo, installerApiSimulee } from "./api";
import photoRabia from "../public/avocats/rafik-rabia.jpg";
import photoBen from "../public/avocats/ahlem-ben-abderrazak.jpg";
import photoKhamlichi from "../public/avocats/mohamed-khamlichi.jpg";

installerApiSimulee();
// Les photos des avocats sont intégrées à la page (pas de serveur de fichiers dans la démo).
new MutationObserver(() => {
  document.querySelectorAll<HTMLImageElement>('img[src^="/avocats/"]').forEach((i) => {
    const src = i.getAttribute("src")!;
    if (PHOTOS[src]) i.src = PHOTOS[src];
  });
}).observe(document.documentElement, { subtree: true, childList: true });
(window as unknown as { __lexpatriaNaviguer: (u: string) => void }).__lexpatriaNaviguer = (u) => {
  const x = new URL(u, "https://demo.lexpatria.fr");
  naviguer(x.pathname + x.search);
};
const PHOTOS: Record<string, string> = {
  "/avocats/rafik-rabia.jpg": photoRabia,
  "/avocats/ahlem-ben-abderrazak.jpg": photoBen,
  "/avocats/mohamed-khamlichi.jpg": photoKhamlichi,
};

function Avocats() {
  const t = useT();
  return (
    <section className="sec h-law">
      <h2>{t("Vos avocats")}</h2>
      {AVOCATS.map((a) => (
        <div className="hl" key={a.nom}>
          <span className="av" aria-hidden style={a.photo ? { overflow: "hidden", padding: 0 } : undefined}>
            {a.photo ? (
              <img src={PHOTOS[a.photo]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", display: "block" }} />
            ) : (
              a.nom.replace("Me ", "").split(" ").map((x) => x[0]).join("")
            )}
          </span>
          <div>
            <b>{a.nom}</b>
            <p>{t(a.titre)}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function Accueil() {
  const t = useT();
  return (
    <>
      <EnteteSite />
      <main>
        <div className="wrap">
          <section className="hero h41">
            <div>
              <h1>{t("Une décision de la préfecture ou du consulat à contester ?")}</h1>
              <p className="sub">{t("OQTF, refus de titre de séjour, refus de visa, naturalisation, préfecture qui ne répond pas : des avocats au barreau de Paris forment votre recours.")}</p>
              <div className="h-cta ph-cta">
                <BoutonsAccueil />
                <p className="ph-ia">{t("Votre décision est lue par un outil d'intelligence artificielle du cabinet, puis vérifiée par votre avocat.")}</p>
              </div>
            </div>
          </section>
          <Avocats />
          <section className="sec">
            <div className="lv attente" role="group" aria-label={t("Le mot de l'avocat")}>
              <div className="lv-m">
                <span className="lv-t">{t("Le mot de l'avocat")}</span>
                <span className="lv-w">{t("Un avocat du cabinet · 45 s")}</span>
              </div>
            </div>
            <p className="lv-n">{t("Vidéo en préparation : elle sera tournée par un avocat du cabinet et sous-titrée en français, arabe, anglais et espagnol.")}</p>
          </section>
          <section className="sec h-steps">
            <h2>{t("Comment se déroule votre recours")}</h2>
            <ol>
              <li>{t("Vous exposez votre situation ou photographiez votre décision.")}</li>
              <li>{t("La procédure adaptée, votre délai et le prix vous sont indiqués.")}</li>
              <li>{t("Votre avocat forme le recours, devant l'administration ou le tribunal selon votre cas, et vous tient informé à chaque étape.")}</li>
            </ol>
          </section>
          <section className="sec h-situ">
            <h2>{t("Vos démarches")}</h2>
            <p>{t("Les délais et la procédure, expliqués situation par situation.")}</p>
            <nav className="si-list" aria-label={t("Vos démarches")}>
              {SITUATIONS.map((s) => (
                <Link key={s.slug} className="link" href={`/${s.slug}`}>
                  {t(s.nav)}
                </Link>
              ))}
            </nav>
          </section>
          <section className="sec h-faq">
            <h2>{t("Questions fréquentes")}</h2>
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{t(f.q)}</summary>
                <p>{t(f.r)}</p>
              </details>
            ))}
          </section>
          <PiedSite />
        </div>
      </main>
    </>
  );
}

function Riche({ t }: { t: string }) {
  return <>{t.split(/(\*\*[^*]+\*\*)/).map((m, i) => (m.startsWith("**") ? <strong key={i}>{m.slice(2, -2)}</strong> : m))}</>;
}

function Situation({ slug }: { slug: string }) {
  const p = parSlug(slug)!;
  return (
    <>
      <EnteteSite />
      <main>
        <div className="wrap situ" style={{ maxWidth: 780 }}>
          <nav className="si-nav" aria-label="Vos démarches">
            {SITUATIONS.map((s) => (
              <Link key={s.slug} href={`/${s.slug}`} className={s.slug === p.slug ? "on" : ""}>
                {s.nav}
              </Link>
            ))}
          </nav>
          <div className="eyebrow">Vos démarches</div>
          <h1>{p.titre}</h1>
          <p className="serif si-chapo">{p.chapo}</p>
          {p.sections.map((s) => (
            <section key={s.titre} className="si-s">
              <h2>{s.titre}</h2>
              {s.blocs.map((b: Bloc, i: number) =>
                Array.isArray(b) ? (
                  <ul key={i}>
                    {b.map((x) => (
                      <li key={x}>
                        <Riche t={x} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p key={i}>
                    <Riche t={b} />
                  </p>
                ),
              )}
            </section>
          ))}
          <div className="si-cta">
            <p>Chaque situation est particulière. Vous pouvez nous exposer la vôtre : la procédure applicable et votre date limite vous sont indiquées, puis un avocat du cabinet étudie votre dossier.</p>
            <Link className="btn cta" href="/depot">
              Exposer ma situation
            </Link>
          </div>
          <p className="si-src">
            <b>Textes de référence :</b> {p.textes}
          </p>
          <PiedSite />
        </div>
      </main>
    </>
  );
}

function PageSimple({ titre, sur, children }: { titre: string; sur: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <>
      <EnteteSite />
      <main>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="eyebrow">{t(sur)}</div>
          <h1>{t(titre)}</h1>
          {children}
          <PiedSite />
        </div>
      </main>
    </>
  );
}

function Honoraires() {
  const t = useT();
  const L: [keyof typeof TARIFS_DEFAUT, string][] = [
    ["REQUETE", "Requête devant le tribunal administratif (tous les mémoires et la plaidoirie compris)"],
    ["REFERE_LIBERTE", "Référé-liberté ou référé mesures utiles"],
    ["REFERE_SUSPENSION_AVEC_REQUETE", "Référé-suspension, engagé avec la requête"],
    ["REFERE_SUSPENSION_SEUL", "Référé-suspension seul"],
    ["RAPO", "Recours administratif préalable obligatoire (visa, naturalisation)"],
    ["RECOURS_GRACIEUX", "Recours gracieux"],
    ["MISE_EN_DEMEURE", "Mise en demeure de la préfecture"],
    ["AVIS_PREALABLE", "Avis écrit d'un avocat"],
    ["DIAGNOSTIC", "Diagnostic écrit de votre situation"],
    ["MAJORATION_URGENCE", "Prise en charge en urgence (délai de moins de 3 jours ouvrés)"],
    ["APPEL", "Appel devant la cour administrative d'appel"],
  ];
  return (
    <PageSimple sur="Honoraires" titre="Des honoraires fixés à l'avance">
      <p className="serif" style={{ color: "var(--ink-2)", fontSize: 18 }}>
        {t("Forfaits fermes, toutes taxes comprises, identiques pour tous les clients. Le prix de votre recours vous est indiqué dès que la procédure adaptée est identifiée, avant tout paiement. Paiement en une fois ou en trois fois.")}
      </p>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="lines">
          {L.map(([d, l]) => (
            <div className="line" key={d}>
              <span>{t(l)}</span>
              <b>{formatEuros(TARIFS_DEFAUT[d])}</b>
            </div>
          ))}
        </div>
        <p className="note warn">{t("Aide juridictionnelle non acceptée.")}</p>
      </div>
      <h2 style={{ marginTop: 28 }}>{t("Contestations et médiation")}</h2>
      <p>
        {t("Toute contestation relative aux honoraires est portée devant le Bâtonnier de l'Ordre des avocats de Paris. Vous pouvez également, après une réclamation écrite adressée au cabinet, recourir au médiateur de la consommation de la profession d'avocat, 180 boulevard Haussmann, 75008 Paris.")}{" "}
        <a className="link" href="https://mediateur-consommation-avocat.fr" target="_blank" rel="noreferrer">
          mediateur-consommation-avocat.fr
        </a>
      </p>
    </PageSimple>
  );
}

function Cabinet() {
  const t = useT();
  return (
    <PageSimple sur="Le cabinet" titre="Des avocats au barreau de Paris">
      <p className="serif" style={{ color: "var(--ink-2)", fontSize: 18 }}>
        {t("Lexpatria Avocats est la dénomination commerciale de la SELARL VARTIS Avocats, cabinet d'avocats au barreau de Paris, 222 boulevard Saint-Germain, 75007 Paris. Chaque dossier déposé sur la plateforme est pris en charge par un avocat du cabinet, qui étudie la situation, rédige, relit et dépose personnellement chaque acte.")}
      </p>
      <Avocats />
    </PageSimple>
  );
}

function Merci({ reference }: { reference: string }) {
  const t = useT();
  const d = dossierDemo(reference) as { avisPrealable?: boolean; procedure?: string; traitement?: string } | undefined;
  const avis = d?.avisPrealable || d?.procedure === "DIAGNOSTIC";
  const delai = t(d?.traitement === "URGENCE" ? "10 heures ouvrées" : "48 heures ouvrées");
  return (
    <>
      <EnteteParcours />
      <main>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="succ">
            <span className="succ-i" aria-hidden>✓</span>
            <div>
              <b>{t("Paiement validé")}</b>
              <span>{t("Votre dossier sera traité par Maître {nom}, qui prendra attache avec vous sous {delai}.", { nom: `${AVOCAT_DEMO.prenom} ${AVOCAT_DEMO.nom}`, delai })}</span>
            </div>
          </div>
          <p className="pp-ref">{t("Dossier {ref}. Vous recevez un e-mail de confirmation avec votre lien de connexion.", { ref: reference })}</p>
          <div className="card">
            {avis ? (
              <p>{t("Votre avocat dispose de votre questionnaire et de vos documents. Vous recevez son avis écrit sous 48 heures ouvrées, dans votre espace.")}</p>
            ) : (
              <>
                <h2>{t("Pour que votre avocat avance dès maintenant")}</h2>
                <ol className="apres">
                  <li>{t("Photographiez la décision contestée (toutes les pages), si ce n'est pas déjà fait.")}</li>
                  <li>{t("Photographiez l'enveloppe ou la preuve de notification : elle fixe votre délai.")}</li>
                  <li>{t("Ajoutez vos autres documents à votre rythme ; si vous n'en avez pas un, indiquez-le simplement.")}</li>
                </ol>
                <p className="note">{t("Espace client en cours de construction (lot 2).")}</p>
              </>
            )}
            <Link className="btn cta" href="/">
              Recommencer la démonstration
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

function App() {
  const chemin = useChemin();
  const [langue, setLangue] = useState<Langue>("fr");
  useEffect(() => {
    document.documentElement.lang = langue;
    document.documentElement.dir = sens(langue);
  }, [langue]);
  const [p, q] = chemin.split("?");
  const params = new URLSearchParams(q ?? "");
  let page;
  if (p === "/depot") page = <Parcours key={chemin} modePhoto={params.get("mode") === "photo"} />;
  else if (p === "/depot/merci") page = <Merci reference={params.get("ref") ?? ""} />;
  else if (p === "/honoraires") page = <Honoraires />;
  else if (p === "/cabinet") page = <Cabinet />;
  else if (parSlug(p.slice(1))) page = <Situation slug={p.slice(1)} />;
  else page = <Accueil />;
  return (
    <FournisseurLangue langue={langue} changer={setLangue}>
      <div className="bandeau-demo">
        Démonstration : orientation et paiement simulés, aucune donnée n&apos;est envoyée.
        <span className="bd-liens">
          <button onClick={() => ouvrirEspace("client")}>Espace client</button>
          <button onClick={() => ouvrirEspace("cabinet")}>Cabinet · avocat &amp; back office</button>
        </span>
      </div>
      <Garde key={chemin}>{page}</Garde>
    </FournisseurLangue>
  );
}

class Garde extends Component<{ children: ReactNode }, { erreur: string | null }> {
  state = { erreur: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { erreur: e instanceof Error ? `${e.name} : ${e.message}` : String(e) };
  }
  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <div className="wrap" style={{ padding: "40px 16px" }}>
        <h1 style={{ fontFamily: "var(--serif)" }}>La démonstration a rencontré une erreur.</h1>
        <p>Message technique à transmettre : <code>{this.state.erreur}</code></p>
        <button className="btn cta" onClick={() => { this.setState({ erreur: null }); naviguer("/"); }}>Revenir à l&apos;accueil</button>
      </div>
    );
  }
}

createRoot(document.getElementById("racine")!).render(<App />);
