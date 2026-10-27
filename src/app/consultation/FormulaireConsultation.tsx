"use client";
// Consultation en visio (30 minutes) : coordonnées et question, convention, paiement, puis choix du créneau.
import { useEffect, useMemo, useState } from "react";
import ChampsAdresse from "@/app/depot/Adresse";
import PaiementIntegre from "@/app/depot/PaiementIntegre";
import { useContenus } from "@/app/composants/Contenus";
import { useLangue, useT } from "@/i18n/client";
import { resumeConvention, texteConvention } from "@/lib/convention";
import { adresseComplete, adresseEnLignes, nomPays, PAYS, tvaApplicable } from "@/lib/pays";
import { formatEuros, LIBELLES_DILIGENCE } from "@/lib/procedures";

export default function FormulaireConsultation({ source }: { source?: string }) {
  const t = useT();
  const langue = useLangue();
  const prix = useContenus().tarifs.CONSULTATION;
  const [c, setC] = useState({ civilite: "", prenom: "", nom: "", email: "", telephone: "", adresse: "", codePostal: "", ville: "", pays: "FR" });
  const [question, setQuestion] = useState("");
  const [cree, setCree] = useState<{ jeton: string; jetonRdv: string; reference: string } | null>(null);
  const [caseConvention, setCaseConvention] = useState(false);
  const [caseExecution, setCaseExecution] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Les noms de pays viennent des données du navigateur, qui diffèrent de celles du serveur :
  // la liste complète n'est construite qu'une fois la page chargée, pour éviter un écart d'affichage.
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);
  const listePays = useMemo(
    () =>
      monte
        ? PAYS.map((p) => [p, nomPays(p, langue)] as const).sort((a, b) => (a[0] === "FR" ? -1 : b[0] === "FR" ? 1 : a[1].localeCompare(b[1], langue)))
        : ([["FR", "France"]] as const),
    [langue, monte],
  );
  const ok =
    c.civilite && c.prenom.trim() && c.nom.trim() && /\S+@\S+\.\S+/.test(c.email) && c.telephone.replace(/\D/g, "").length >= 8 && adresseComplete(c) && question.trim().length >= 10;
  const horsUE = !tvaApplicable(c.pays);
  const convention = {
    civilite: (c.civilite || undefined) as "MADAME" | "MONSIEUR" | undefined,
    prenom: c.prenom,
    nom: c.nom,
    adresse: adresseEnLignes(c).join(", ") || undefined,
    horsUE,
    reference: cree?.reference ?? "—",
    procedureLibelle: "Consultation en visio avec un avocat",
    recoursPrealable: false,
    consultation: true,
    lignes: [{ diligence: "CONSULTATION" as const, libelle: LIBELLES_DILIGENCE.CONSULTATION, montant: prix }],
  };

  async function continuer() {
    setEnvoi(true);
    setErreur(null);
    const r = await fetch("/api/consultation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ coordonnees: c, question, langue, source }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setEnvoi(false);
    if (!r?.ok) return setErreur(j?.erreur ?? t("Une erreur est survenue."));
    setCree(j);
  }

  if (cree)
    return (
      <div className="card">
        <p className="surtitre">{t("Consultation en visio")}</p>
        <h1>{t("Règlement de votre consultation")}</h1>
        <div className="recap">
          <span>{horsUE ? t("Honoraires (TVA non applicable)") : t("Honoraires TTC")}</span> <b>{formatEuros(prix)}</b>
        </div>
        <div className="p1-conv">
          <b>{t("Convention d'honoraires, en résumé")}</b>
          <ul>
            {langue !== "fr" && <li>{t("La convention d'honoraires est rédigée en français.")}</li>}
            {resumeConvention(convention).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <details className="esp-conv">
            <summary>{t("Lire la convention complète")}</summary>
            <pre>{texteConvention(convention)}</pre>
          </details>
        </div>
        <p className="lx-aj">
          <b>{t("Aide juridictionnelle non acceptée.")}</b> {t("Les honoraires sont ceux indiqués ci-dessus.")}
        </p>
        <label className="chk p1-acc">
          <input type="checkbox" checked={caseConvention} onChange={(e) => setCaseConvention(e.target.checked)} />
          {t("J'accepte la convention d'honoraires.")}
        </label>
        <label className="chk p1-acc">
          <input type="checkbox" checked={caseExecution} onChange={(e) => setCaseExecution(e.target.checked)} />
          {t("Je demande que l'avocat commence sans attendre la fin de mon délai de rétractation de 14 jours.")}
        </label>
        <PaiementIntegre
          total={prix}
          verifier={() => (!caseConvention || !caseExecution ? t("Cochez les deux cases ci-dessus pour payer.") : null)}
          ouvrir={async () => {
            const r = await fetch("/api/paiement", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ jeton: cree.jeton, accepteConvention: true, executionImmediate: true }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.erreur);
            return j;
          }}
          urlRetour={() => `${window.location.origin}/consultation/rendez-vous?jeton=${encodeURIComponent(cree.jetonRdv)}`}
        />
        <p className="p1-sec">{t("Paiement sécurisé 3-D Secure (Stripe)")}</p>
        <p className="p1-med">
          {t("Contestation des honoraires : Bâtonnier de l'Ordre des avocats de Paris.")} {t("En cas de litige, vous pouvez saisir le médiateur de la consommation de la profession d'avocat.")}
        </p>
      </div>
    );

  return (
    <div className="card q1">
      <p className="surtitre">{t("Consultation en visio")}</p>
      <h1>{t("Consultation avec un avocat")}</h1>
      <p>{t("Un entretien de 30 minutes en visio avec un avocat au barreau de Paris. Vous choisissez le créneau juste après le paiement.")}</p>
      <div className="recap">
        <span>{t("Honoraires TTC")}</span> <b>{formatEuros(prix)}</b>
      </div>
      <div className="fields q1-f">
        <div className="f full">
          <label htmlFor="c_question">{t("Votre question")} *</label>
          <textarea id="c_question" rows={4} maxLength={3000} value={question} onChange={(e) => setQuestion(e.target.value)} />
          <span className="help">{t("Quelques lignes suffisent : votre avocat la lit avant le rendez-vous.")}</span>
        </div>
        <div className="f full">
          <label>{t("Civilité")} *</label>
          <div className="yn">
            {(["MADAME", "MONSIEUR"] as const).map((x) => (
              <button key={x} type="button" className={c.civilite === x ? "sel" : ""} onClick={() => setC({ ...c, civilite: x })}>
                {t(x === "MADAME" ? "Madame" : "Monsieur")}
              </button>
            ))}
          </div>
        </div>
        <div className="f">
          <label htmlFor="c_prenom">{t("Prénom")} *</label>
          <input id="c_prenom" autoComplete="given-name" value={c.prenom} onChange={(e) => setC({ ...c, prenom: e.target.value })} />
        </div>
        <div className="f">
          <label htmlFor="c_nom">{t("Nom")} *</label>
          <input id="c_nom" autoComplete="family-name" value={c.nom} onChange={(e) => setC({ ...c, nom: e.target.value })} />
        </div>
        <div className="f">
          <label htmlFor="c_email">{t("E-mail")} *</label>
          <input id="c_email" type="email" autoComplete="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
        </div>
        <div className="f">
          <label htmlFor="c_tel">{t("Téléphone")} *</label>
          <input id="c_tel" type="tel" autoComplete="tel" value={c.telephone} onChange={(e) => setC({ ...c, telephone: e.target.value })} />
        </div>
        <ChampsAdresse valeur={c} changer={(v) => setC((x) => ({ ...x, ...v }))} listePays={listePays} />
      </div>
      {erreur && <p className="erreur">{erreur}</p>}
      <div className="actions">
        <button className="btn cta" disabled={!ok || envoi} onClick={continuer}>
          {t("Continuer vers le paiement")}
        </button>
      </div>
    </div>
  );
}
