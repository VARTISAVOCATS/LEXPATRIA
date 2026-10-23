"use client";
// Back office › Blog : l'associé rédige, fait préparer un brouillon par l'IA, relit, puis publie.
// Rien n'est publié sans lui ; un mot interdit (gratuit, garanti, spécialiste…) bloque la publication.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Contenu from "../../actualites/Contenu";

export interface ArticleBO {
  id: string;
  slug: string;
  titre: string;
  chapo: string;
  contenu: string;
  procedure: string | null;
  publie: boolean;
  le: string;
}

const SUJETS = [
  "Quel délai pour contester une OQTF ?",
  "Refus de titre de séjour : que faire ?",
  "Visa refusé : le recours devant la commission",
  "La préfecture ne répond pas à ma demande de titre",
  "Récépissé expiré et emploi menacé : le référé",
  "Naturalisation refusée ou ajournée : le recours au ministre",
  "Certificat de résidence algérien : ce que change l'accord de 1968",
];

const VIDE = { id: "", titre: "", chapo: "", contenu: "", procedure: "" };

export default function Blog({ articles, procedures }: { articles: ArticleBO[]; procedures: [string, string][] }) {
  const router = useRouter();
  const [edite, setEdite] = useState<typeof VIDE>(VIDE);
  const [sujet, setSujet] = useState("");
  const [apercu, setApercu] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const courant = articles.find((a) => a.id === edite.id);

  async function appeler(corps: object, message: string) {
    setEnvoi(true);
    setErreur(null);
    setInfo(null);
    const r = await fetch("/api/backoffice/blog", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnvoi(false);
    if (!r?.ok) {
      setErreur(j.erreur ?? "Opération impossible.");
      return null;
    }
    setInfo(message);
    router.refresh();
    return j as { article?: ArticleBO & { id: string } };
  }

  const ouvrir = (a: ArticleBO) => {
    setEdite({ id: a.id, titre: a.titre, chapo: a.chapo, contenu: a.contenu, procedure: a.procedure ?? "" });
    setApercu(false);
    setErreur(null);
    setInfo(null);
  };

  return (
    <section className="card bo-blog">
      <h2>Blog « Actualités »</h2>
      <p className="note">Des articles d&apos;information qui attirent des visiteurs depuis les moteurs de recherche. Chaque article se termine par l&apos;invitation à engager la procédure.</p>

      <div className="f">
        <label htmlFor="bo_sujet">Faire rédiger un brouillon par l&apos;IA</label>
        <input id="bo_sujet" className="champ" list="bo_sujets" value={sujet} placeholder="Sujet de l'article" onChange={(e) => setSujet(e.target.value)} />
        <datalist id="bo_sujets">
          {SUJETS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <button
          className="btn"
          disabled={envoi || sujet.trim().length < 5}
          onClick={async () => {
            const j = await appeler({ action: "rediger", sujet }, "Brouillon prêt : relisez-le, complétez les « XXX », puis publiez.");
            if (j?.article) ouvrir({ ...j.article, le: "" });
            setSujet("");
          }}
        >
          {envoi ? "Rédaction en cours…" : "Rédiger le brouillon"}
        </button>
      </div>

      <div className="bo-blog-liste">
        {articles.map((a) => (
          <div key={a.id} className={`bo-blog-ligne ${a.id === edite.id ? "on" : ""}`}>
            <span>
              <b>{a.titre}</b> <span className={`pill ${a.publie ? "ok" : "n"}`}>{a.publie ? "Publié" : "Brouillon"}</span> <small>{a.le}</small>
            </span>
            <span>
              <button className="btn sm ghost" onClick={() => ouvrir(a)}>
                Modifier
              </button>
              {a.publie && (
                <a className="btn sm ghost" href={`/actualites/${a.slug}`} target="_blank" rel="noreferrer">
                  Voir
                </a>
              )}
            </span>
          </div>
        ))}
        {articles.length === 0 && <p className="note">Aucun article pour le moment.</p>}
      </div>
      <button className="btn sm" onClick={() => setEdite(VIDE)}>
        Nouvel article
      </button>

      <hr />
      <h3>{edite.id ? "Modifier l'article" : "Nouvel article"}</h3>
      {erreur && <p className="erreur">{erreur}</p>}
      {info && <p className="note ok">{info}</p>}
      <div className="f">
        <label htmlFor="bo_titre">Titre (la question que se pose le lecteur)</label>
        <input id="bo_titre" className="champ" value={edite.titre} maxLength={160} onChange={(e) => setEdite({ ...edite, titre: e.target.value })} />
      </div>
      <div className="f">
        <label htmlFor="bo_chapo">Chapô (résumé, 160 caractères conseillés)</label>
        <input id="bo_chapo" className="champ" value={edite.chapo} maxLength={400} onChange={(e) => setEdite({ ...edite, chapo: e.target.value })} />
      </div>
      <div className="f">
        <label htmlFor="bo_proc">Procédure liée</label>
        <select id="bo_proc" className="champ" value={edite.procedure} onChange={(e) => setEdite({ ...edite, procedure: e.target.value })}>
          <option value="">Aucune</option>
          {procedures.map(([c, l]) => (
            <option key={c} value={c}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="f">
        <label htmlFor="bo_contenu">Texte — « ## » intertitre, « - » liste, **gras**</label>
        {apercu ? <Contenu texte={edite.contenu} /> : <textarea id="bo_contenu" value={edite.contenu} onChange={(e) => setEdite({ ...edite, contenu: e.target.value })} />}
      </div>
      <div className="actions">
        <button className="btn ghost" onClick={() => setApercu(!apercu)}>
          {apercu ? "Revenir au texte" : "Aperçu"}
        </button>
        <button
          className="btn"
          disabled={envoi || edite.titre.trim().length < 5}
          onClick={async () => {
            const j = await appeler(
              { action: "enregistrer", article: { id: edite.id || undefined, titre: edite.titre, chapo: edite.chapo, contenu: edite.contenu, procedure: edite.procedure || null } },
              "Article enregistré.",
            );
            if (j?.article) setEdite({ ...edite, id: j.article.id });
          }}
        >
          Enregistrer
        </button>
        {edite.id && (
          <button className="btn cta" disabled={envoi} onClick={() => appeler({ action: "publier", id: edite.id, publie: !courant?.publie }, courant?.publie ? "Article retiré du site." : "Article publié.")}>
            {courant?.publie ? "Dépublier" : "Publier"}
          </button>
        )}
        {edite.id &&
          (aSupprimer === edite.id ? (
            <>
              <span>Supprimer définitivement ?</span>
              <button
                className="btn sm"
                onClick={async () => {
                  await appeler({ action: "supprimer", id: edite.id }, "Article supprimé.");
                  setASupprimer(null);
                  setEdite(VIDE);
                }}
              >
                Oui, supprimer
              </button>
              <button className="btn sm ghost" onClick={() => setASupprimer(null)}>
                Annuler
              </button>
            </>
          ) : (
            <button className="btn sm ghost" onClick={() => setASupprimer(edite.id)}>
              Supprimer
            </button>
          ))}
      </div>
      <p className="note">Publiez seulement après relecture : les « XXX » signalent une référence à vérifier.</p>
    </section>
  );
}
