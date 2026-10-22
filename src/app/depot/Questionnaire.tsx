"use client";

// Écrans du questionnaire, de la confirmation des faits et du dépôt des pièces.
// Une question par écran (deux si elles sont de même nature) ; oui/non et choix passent seuls à l'écran suivant.

import { useMemo, useRef, useState } from "react";
import { piecesDemandees, questions, type Contexte, type Question, type Reponses } from "@/lib/questionnaire";
import { useT } from "@/i18n/client";
import { useDictee } from "./dictee";

async function sauver(jeton: string, corps: object) {
  await fetch("/api/questionnaire", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jeton, ...corps }),
  }).catch(() => undefined); // l'enregistrement progressif ne bloque jamais le parcours
}

/* ---------------- Faits tirés du récit ---------------- */

export function ConfirmationFaits({ jeton, faits, suite }: { jeton: string; faits: string[]; suite: () => void }) {
  const t = useT();
  const [etat, setEtat] = useState(faits.map((f) => ({ fait: f, exact: null as boolean | null, correction: "" })));
  const restants = etat.filter((e) => e.exact === null || (e.exact === false && !e.correction.trim())).length;
  return (
    <>
      <p className="surtitre">{t("Votre récit")}</p>
      <h1>{t("Voici ce que nous avons compris")}</h1>
      <p className="aide">{t("Vérifiez chaque point : une erreur de fait peut changer l'issue d'un dossier. Corrigez tout ce qui n'est pas exact.")}</p>
      <ul className="faits-a-confirmer">
        {etat.map((e, i) => (
          <li key={i}>
            <p>{e.fait}</p>
            <div className="choix ligne">
              <button
                className={`btn-choix ${e.exact === true ? "choisi" : ""}`}
                onClick={() => setEtat(etat.map((x, j) => (j === i ? { ...x, exact: true } : x)))}
              >
                {t("C'est exact")}
              </button>
              <button
                className={`btn-choix ${e.exact === false ? "choisi" : ""}`}
                onClick={() => setEtat(etat.map((x, j) => (j === i ? { ...x, exact: false } : x)))}
              >
                {t("Corriger")}
              </button>
            </div>
            {e.exact === false && (
              <input
                className="champ"
                placeholder={t("Ce qui est exact")}
                value={e.correction}
                onChange={(ev) => setEtat(etat.map((x, j) => (j === i ? { ...x, correction: ev.target.value } : x)))}
              />
            )}
          </li>
        ))}
      </ul>
      <div className="bas">
        {restants > 0 && <p className="petite">{t("Confirmez ou corrigez chaque point ({n} restant(s)).", { n: restants })}</p>}
        <button
          className="btn btn-action large"
          disabled={restants > 0}
          onClick={async () => {
            await sauver(jeton, {
              reponses: {},
              faitsConfirmes: etat.map((e) => ({ fait: e.fait, exact: !!e.exact, correction: e.correction || undefined })),
            });
            suite();
          }}
        >
          {t("Continuer")}
        </button>
      </div>
    </>
  );
}

/* ---------------- Questionnaire ---------------- */

export function QuestionnaireEcrans({
  jeton,
  contexte,
  reponsesInitiales,
  suite,
  plusTard,
}: {
  jeton: string;
  contexte: Contexte;
  reponsesInitiales?: Reponses;
  suite: (r: Reponses) => void;
  /** Absent avant paiement pour l'avis : tout est demandé avant de payer, mais chaque question reste passable. */
  plusTard?: () => void;
}) {
  const t = useT();
  const [r, setR] = useState<Reponses>(reponsesInitiales ?? {});
  const [i, setI] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const liste = useMemo(() => questions(contexte, r), [contexte, r]);
  const q = liste[Math.min(i, liste.length - 1)];

  async function avancer(maj: Reponses) {
    const nouvelles = { ...r, ...maj };
    setR(nouvelles);
    void sauver(jeton, { reponses: maj });
    const suivante = questions(contexte, nouvelles);
    if (i + 1 >= suivante.length) return suite(nouvelles);
    setI(i + 1);
    window.scrollTo(0, 0);
  }

  return (
    <>
      <p className="surtitre">
        {t("Question {i} sur {n}", { i: Math.min(i + 1, liste.length), n: liste.length })}
      </p>
      {erreur && <p className="erreur">{erreur}</p>}
      <EcranQuestion key={q.id} q={q} r={r} avancer={avancer} signalerErreur={setErreur} />
      <div className="nav-questions">
        {i > 0 && (
          <button className="lien" onClick={() => setI(i - 1)}>
            {t("Question précédente")}
          </button>
        )}
        {plusTard && (
          <button className="lien" onClick={plusTard}>
            {t("Je compléterai plus tard")}
          </button>
        )}
      </div>
    </>
  );
}

function EcranQuestion({
  q,
  r,
  avancer,
  signalerErreur,
}: {
  q: Question;
  r: Reponses;
  avancer: (m: Reponses) => void;
  signalerErreur: (m: string) => void;
}) {
  const t = useT();
  const [v1, setV1] = useState(r[q.id] ?? "");
  const [v2, setV2] = useState(q.avec ? (r[q.avec.id] ?? "") : "");
  const dictee = useDictee(v1, setV1, signalerErreur);
  const seule = !q.avec && (q.type === "oui_non" || q.type === "choix");

  if (seule) {
    const options = q.type === "oui_non" ? ([["oui", "Oui"], ["non", "Non"]] as [string, string][]) : q.options!;
    return (
      <>
        <h1>{t(q.libelle)}</h1>
        {q.aide && <p className="aide">{t(q.aide)}</p>}
        <div className={`choix ${q.type === "oui_non" ? "ligne" : ""}`}>
          {options.map(([v, l]) => (
            <button key={v} className={`btn-choix ${r[q.id] === v ? "choisi" : ""}`} onClick={() => avancer({ [q.id]: v })}>
              {t(l)}
            </button>
          ))}
        </div>
        <div className="bas">
          <button className="lien" onClick={() => avancer({ [q.id]: "" })}>
            {t("Je ne sais pas, passer")}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>{t(q.libelle)}</h1>
      {q.aide && <p className="aide">{t(q.aide)}</p>}
      <Champ q={q} v={v1} set={setV1} dictee={dictee} />
      {q.avec && (
        <>
          <p className="question">{t(q.avec.libelle)}</p>
          <Champ q={q.avec} v={v2} set={setV2} />
        </>
      )}
      <div className="bas">
        <button
          className="btn btn-action large"
          disabled={!q.facultative && !v1.trim()}
          onClick={() => avancer(q.avec ? { [q.id]: v1, [q.avec.id]: v2 } : { [q.id]: v1 })}
        >
          {t("Continuer")}
        </button>
        <button className="lien" onClick={() => avancer(q.avec ? { [q.id]: "", [q.avec.id]: "" } : { [q.id]: "" })}>
          {t(q.facultative ? "Rien à ajouter" : "Je ne sais pas, passer")}
        </button>
      </div>
    </>
  );
}

function Champ({ q, v, set, dictee }: { q: Question; v: string; set: (s: string) => void; dictee?: ReturnType<typeof useDictee> }) {
  const t = useT();
  if (q.type === "oui_non" || q.type === "choix") {
    const options = q.type === "oui_non" ? ([["oui", "Oui"], ["non", "Non"]] as [string, string][]) : q.options!;
    return (
      <div className={`choix ${q.type === "oui_non" ? "ligne" : ""}`}>
        {options.map(([val, l]) => (
          <button key={val} className={`btn-choix ${v === val ? "choisi" : ""}`} onClick={() => set(val)}>
            {t(l)}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === "texte_long")
    return (
      <div className="champ-recit">
        <textarea rows={4} value={v} onChange={(e) => set(e.target.value)} aria-label={t(q.libelle)} />
        {dictee && (
          <button type="button" className={`micro ${dictee.actif ? "actif" : ""}`} onClick={dictee.basculer} aria-label={t("Dicter")}>
            {dictee.actif ? "■" : "🎙"}
          </button>
        )}
      </div>
    );
  return (
    <input
      className="champ"
      aria-label={t(q.libelle)}
      type={q.type === "date" ? "date" : q.type === "nombre" ? "number" : "text"}
      inputMode={q.type === "nombre" ? "numeric" : undefined}
      min={q.type === "nombre" ? 0 : undefined}
      value={v}
      onChange={(e) => set(e.target.value)}
    />
  );
}

/* ---------------- Pièces ---------------- */

type EtatPiece = { fichiers: number; manquante: boolean; envoi: boolean };

export function DepotPieces({
  jeton,
  contexte,
  reponses,
  suite,
  titre = "Vos documents",
}: {
  jeton: string;
  contexte: Contexte;
  reponses: Reponses;
  suite: () => void;
  titre?: string;
}) {
  const t = useT();
  const liste = useMemo(() => piecesDemandees(contexte, reponses), [contexte, reponses]);
  const [etat, setEtat] = useState<Record<string, EtatPiece>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  const [cible, setCible] = useState<{ type: string; libelle: string } | null>(null);

  async function envoyer(type: string, libelle: string, fichiers: File[], manquante = false) {
    setEtat((e) => ({ ...e, [type]: { ...(e[type] ?? { fichiers: 0, manquante: false }), envoi: true } }));
    setErreur(null);
    const fd = new FormData();
    fd.set("jeton", jeton);
    fd.set("type", type);
    fd.set("libelle", libelle);
    if (manquante) fd.set("manquante", "1");
    fichiers.forEach((f) => fd.append("fichiers", f));
    const r = await fetch("/api/pieces", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErreur(j.erreur ?? t("Envoi impossible, réessayez."));
      return setEtat((e) => ({ ...e, [type]: { ...(e[type] ?? { fichiers: 0, manquante: false }), envoi: false } }));
    }
    setEtat((e) => {
      const avant = e[type] ?? { fichiers: 0, manquante: false, envoi: false };
      return { ...e, [type]: { fichiers: avant.fichiers + fichiers.length, manquante: manquante && avant.fichiers + fichiers.length === 0, envoi: false } };
    });
  }

  const traitees = liste.filter((p) => (etat[p.type]?.fichiers ?? 0) > 0 || etat[p.type]?.manquante).length;

  return (
    <>
      <p className="surtitre">
        {t("{i} sur {n}", { i: traitees, n: liste.length })}
      </p>
      <h1>{t(titre)}</h1>
      <p className="aide">
        {t(
          "Liste établie pour votre situation. Prenez une photo ou ajoutez un fichier ; plusieurs documents sont possibles pour une même pièce. Si vous n'avez pas un document, indiquez-le : votre avocat en tiendra compte.",
        )}
      </p>
      {erreur && <p className="erreur">{erreur}</p>}
      <ul className="pieces">
        {liste.map((p) => {
          const e = etat[p.type];
          const fournie = (e?.fichiers ?? 0) > 0;
          return (
            <li key={p.type} className={fournie ? "fournie" : e?.manquante ? "manquante" : ""}>
              <div>
                <strong>{t(p.libelle, p.vars)}</strong>
                <span>{t(p.pourquoi)}</span>
                {fournie && <span className="statut">✓ {t("{n} document(s)", { n: e!.fichiers })}</span>}
                {e?.manquante && <span className="statut">{t("Indiqué comme non disponible")}</span>}
              </div>
              <div className="actions-piece">
                <button
                  className="btn btn-encre"
                  disabled={e?.envoi}
                  onClick={() => {
                    setCible({ type: p.type, libelle: p.libelle });
                    champ.current?.click();
                  }}
                >
                  {e?.envoi ? t("Envoi…") : t("Ajouter")}
                </button>
                {!fournie && !e?.manquante && (
                  <button className="lien" onClick={() => envoyer(p.type, p.libelle, [], true)}>
                    {t("Je ne l'ai pas")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <input
        ref={champ}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(ev) => {
          const f = Array.from(ev.target.files ?? []);
          ev.target.value = "";
          if (cible && f.length) void envoyer(cible.type, cible.libelle, f);
        }}
      />
      <div className="bas">
        <button className="btn btn-action large" onClick={suite}>
          {t("Continuer")}
        </button>
      </div>
    </>
  );
}
