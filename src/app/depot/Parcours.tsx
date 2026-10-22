"use client";

// Parcours de dépôt avant paiement (cahier des charges, section 4), toutes procédures.
// Une action par écran, avancer par défaut, rien ne distrait, aucun prix avant « Votre recours ».
// Chaque procédure ne pose que les questions qui fixent la procédure, le délai et le prix.

import { useEffect, useMemo, useRef, useState } from "react";
import { jour, versJour } from "@/lib/calendrier";
import { apresPaiement, CONTENUS, SUGGESTIONS } from "@/lib/contenus";
import { resumeConvention, texteConvention } from "@/lib/convention";
import { evaluerDelai, type ResultatDelai, type SituationOQTF } from "@/lib/delais";
import { adresseComplete, adresseEnLignes, nomPays, PAYS, tvaApplicable } from "@/lib/pays";
import { useContenus } from "../composants/Contenus";
import { composerOffre, estRecoursPrealable, formatEuros, PROCEDURES, troisFois, type CodeProcedure } from "@/lib/procedures";
import type { ResultatTriage } from "@/lib/triage";
import { ChoixLangue, useLangue, useT } from "@/i18n/client";
import { fichiersEnAttente } from "./fichiers";
import PaiementIntegre from "./PaiementIntegre";
import { EnteteParcours } from "../composants/Entete";
import { useDictee } from "./dictee";
import { ConfirmationFaits, DepotPieces, QuestionnaireEcrans } from "./Questionnaire";

type Etape =
  | "RECIT"
  | "ANALYSE"
  | "REFUS"
  | "Q_SITUATION"
  | "Q_VISA"
  | "Q_NATU"
  | "Q_EMPLOI"
  | "Q_ECHEANCE"
  | "Q_DIAG"
  | "DATE"
  | "RESULTAT"
  | "RECOURS"
  | "COORDONNEES"
  | "FAITS"
  | "QUESTIONNAIRE"
  | "PIECES"
  | "PRET"
  | "PAIEMENT"
  | "PROCHE";

type Refus = "DETENTION" | "RETENTION" | "HORS_PERIMETRE";

const SITUATIONS: { v: SituationOQTF; l: string }[] = [
  { v: "LIBRE", l: "Je vis à mon adresse, sans obligation de pointer" },
  { v: "ASSIGNE", l: "Je dois pointer au commissariat ou rester à une adresse imposée" },
  { v: "LIBRE_APRES_ASILE", l: "Je vis à mon adresse, ma demande d'asile a été rejetée" },
  { v: "DETENTION", l: "Je suis en prison" },
  { v: "RETENTION", l: "Je suis dans un centre de rétention" },
  { v: "INCONNUE", l: "Je ne sais pas" },
];

const AVEC_DATE: CodeProcedure[] = ["OQTF", "REFUS_TITRE", "REFUS_VISA", "NATURALISATION", "REFUS_IMPLICITE"];
const REGIME_ALGERIEN: CodeProcedure[] = ["OQTF", "REFUS_TITRE", "REFUS_IMPLICITE", "BLOCAGE_EMPLOI", "BLOCAGE_SIMPLE"];
const ETAPES_PROGRESSION: Etape[] = ["RECIT", "RESULTAT", "RECOURS", "COORDONNEES", "FAITS", "QUESTIONNAIRE", "PIECES", "PRET", "PAIEMENT"];

const isoVersDate = (s?: string | null) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return jour(y, m, d);
};
const LOCALES = { fr: "fr-FR", ar: "ar", en: "en-GB", es: "es-ES" } as const;
let localeCourante: keyof typeof LOCALES = "fr";
const dateLongue = (d: Date) => {
  const s = new Intl.DateTimeFormat(LOCALES[localeCourante], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC", numberingSystem: "latn" }).format(d);
  return localeCourante === "fr" ? s.replace(/^1 /, "1er ") : s;
};
type FonctionT = (texte: string, vars?: Record<string, string | number>) => string;
const joursPourAgir = (n: number, t: FonctionT) =>
  n <= 0 ? t("Dernier jour aujourd'hui") : n === 1 ? t("1 jour pour agir") : t("{n} jours pour agir", { n });

async function enBase64(f: File): Promise<{ mime: string; base64: string }> {
  if (f.type === "application/pdf") {
    const buf = new Uint8Array(await f.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { mime: "application/pdf", base64: btoa(bin) };
  }
  // Photo réduite à 2 000 px de côté, en JPEG, pour un envoi rapide en 4G.
  const img = await createImageBitmap(f);
  const k = Math.min(1, 2000 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return { mime: "image/jpeg", base64: c.toDataURL("image/jpeg", 0.82).split(",")[1] };
}

export default function Parcours({ modePhoto, source, reprise }: { modePhoto: boolean; source?: string; reprise?: string }) {
  const t = useT();
  const { tarifs } = useContenus();
  localeCourante = useLangue();
  const [etape, setEtape] = useState<Etape>(modePhoto ? "ANALYSE" : "RECIT");
  const [erreur, setErreur] = useState<string | null>(null);

  // Récit
  const [recit, setRecit] = useState("");
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [suggestionsOuvertes, setSuggestionsOuvertes] = useState(false);
  const champFichier = useRef<HTMLInputElement>(null);

  // Orientation et qualification
  const [triage, setTriage] = useState<ResultatTriage | null>(null);
  const [procedure, setProcedure] = useState<CodeProcedure | null>(null);
  const [refus, setRefus] = useState<Refus | null>(null);
  const [situation, setSituation] = useState<SituationOQTF | null>(null);
  const [visaType, setVisaType] = useState<"COURT" | "LONG" | null>(null);
  const [natuIssue, setNatuIssue] = useState<"REFUS" | "AJOURNEMENT" | null>(null);
  const [emploi, setEmploi] = useState<boolean | null>(null);
  const [echeance, setEcheance] = useState<string | null | undefined>(undefined); // undefined : pas encore demandée
  const [question, setQuestion] = useState("");
  const [dateLue, setDateLue] = useState<string | null>(null);
  const [dateRef, setDateRef] = useState<string | null | undefined>(undefined); // undefined : pas encore demandée
  const [dateDemande, setDateDemande] = useState<string | null>(null);
  const [apresRecours, setApresRecours] = useState(false);
  const [correction, setCorrection] = useState(false);
  const [avisPrealable, setAvisPrealable] = useState(false);

  // Coordonnées et paiement
  const [coord, setCoord] = useState({ civilite: "", prenom: "", nom: "", email: "", telephone: "", adresse: "", codePostal: "", ville: "", pays: "FR" });
  const [algerien, setAlgerien] = useState<boolean | null>(null);
  const [consent, setConsent] = useState(false);
  const [jeton, setJeton] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [caseConvention, setCaseConvention] = useState(false);
  const [caseExecution, setCaseExecution] = useState(false);
  const [voirConvention, setVoirConvention] = useState(false);
  const [lienProche, setLienProche] = useState<string | null>(null);
  const [reponses, setReponses] = useState<Record<string, string | undefined>>({});
  const [envoi, setEnvoi] = useState(false);
  const [troisFoisChoisi, setTroisFoisChoisi] = useState(false);

  const dicteeRecit = useDictee(recit, setRecit, setErreur);
  const dicteeQuestion = useDictee(question, setQuestion, setErreur);

  useEffect(() => {
    if (modePhoto && fichiersEnAttente.length) {
      const f = [...fichiersEnAttente];
      fichiersEnAttente.length = 0;
      setFichiers(f);
      void analyser("", f);
    } else if (modePhoto) setEtape("RECIT");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => window.scrollTo(0, 0), [etape]);

  // ---- Reprise d'un pré-dossier au point d'arrêt (lien de relance, paiement annulé) ----
  useEffect(() => {
    if (!reprise) return;
    (async () => {
      const r = await fetch(`/api/reprise?jeton=${encodeURIComponent(reprise)}`);
      const j = await r.json();
      if (!r.ok) return setErreur(j.erreur);
      setJeton(j.jeton);
      setReference(j.reference);
      setProcedure(j.procedure);
      setSituation(j.situationOQTF);
      setDateRef(j.dateReference ?? null);
      setDateDemande(j.dateDemande);
      setEcheance(j.dateEcheance ?? null);
      setAvisPrealable(j.avisPrealable);
      setTriage(j.triage);
      setCoord({ adresse: "", codePostal: "", ville: "", pays: "FR", ...j.coordonnees });
      setAlgerien(j.algerien);
      const q = j.qualification ?? {};
      setVisaType(q.visaType ?? null);
      setNatuIssue(q.naturalisationIssue ?? null);
      setEmploi(q.emploiMenace ?? null);
      setQuestion(q.question ?? "");
      setReponses(q.reponses ?? {});
      const avisOuDiag = j.avisPrealable || j.procedure === "DIAGNOSTIC";
      const reprisePossible = ["FAITS", "QUESTIONNAIRE", "PIECES", "PRET"];
      setEtape(avisOuDiag ? (reprisePossible.includes(j.etapeAtteinte) ? j.etapeAtteinte : "QUESTIONNAIRE") : "PAIEMENT");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reprise]);

  // ---- Bouton « retour » du téléphone : écran précédent, et motif d'abandon à la sortie de l'écran du prix ----
  const [motifOuvert, setMotifOuvert] = useState(false);
  const motifDemande = useRef(false);
  const etapeRef = useRef<Etape>(etape);
  useEffect(() => {
    const precedente = etapeRef.current;
    etapeRef.current = etape;
    if (precedente === etape) return;
    // Certains navigateurs (Safari dans un cadre isolé) refusent l'historique : le parcours continue sans.
    try {
      if ((window.history.state as { etape?: Etape } | null)?.etape !== etape) window.history.pushState({ etape }, "");
    } catch {
      /* historique indisponible */
    }
  }, [etape]);
  useEffect(() => {
    const surRetour = (e: PopStateEvent) => {
      const cible = (e.state as { etape?: Etape } | null)?.etape;
      if (etapeRef.current === "RECOURS" && !motifDemande.current) {
        motifDemande.current = true;
        setMotifOuvert(true);
      }
      if (cible && !["ANALYSE", "PAIEMENT", "PROCHE"].includes(cible)) setEtape(cible);
    };
    window.addEventListener("popstate", surRetour);
    return () => window.removeEventListener("popstate", surRetour);
  }, []);

  // ---- Mesure anonyme de l'entonnoir ----
  const session = useMemo(() => {
    try {
      const k = "lexpatria-session";
      const v = sessionStorage.getItem(k) ?? Math.random().toString(36).slice(2, 14);
      sessionStorage.setItem(k, v);
      return v;
    } catch {
      return Math.random().toString(36).slice(2, 14);
    }
  }, []);
  const mesurer = (corps: Record<string, unknown>) =>
    fetch("/api/evenement", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        session,
        procedure,
        source: source ?? null,
        appareil: window.matchMedia("(pointer: coarse)").matches ? "mobile" : "ordinateur",
        langue: document.documentElement.lang,
        ...corps,
      }),
    }).catch(() => undefined);
  useEffect(() => {
    if (etape === "ANALYSE") return;
    void mesurer({ etape, jeton: jeton ?? undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape]);

  const aujourdhui = useMemo(() => versJour(new Date()), []);

  const delai: ResultatDelai | null = useMemo(() => {
    if (!procedure || (procedure === "OQTF" && !situation)) return null;
    return evaluerDelai({
      procedure,
      situationOQTF: situation ?? undefined,
      dateReference: isoVersDate(dateRef),
      dateDemande: isoVersDate(dateDemande),
      dateEcheance: isoVersDate(echeance),
      silenceApresRecoursPrealable: apresRecours,
      aujourdhui,
    });
  }, [procedure, situation, dateRef, dateDemande, echeance, apresRecours, aujourdhui]);

  const urgence = delai?.traitement === "URGENCE" && !avisPrealable;
  const offre = procedure ? composerOffre(procedure, { urgence, avisPrealable }, tarifs) : [];
  const total = offre.reduce((s, l) => s + l.montant, 0);
  const fractionnable = total >= 10_000;
  const echeances3 = troisFois(total);

  /** Prochaine information manquante, dans l'ordre des écrans. */
  function prochaine(etat: {
    p: CodeProcedure | null;
    sit: SituationOQTF | null;
    visa: typeof visaType;
    natu: typeof natuIssue;
    emp: boolean | null;
    ech: string | null | undefined;
    q: string;
    dref: string | null | undefined;
    ddem: string | null;
    depuis: Etape;
  }): Etape {
    const { p } = etat;
    if (!p) return "RECIT";
    if (p === "OQTF" && !etat.sit) return "Q_SITUATION";
    if (p === "REFUS_VISA" && !etat.visa) return "Q_VISA";
    if (p === "NATURALISATION" && !etat.natu) return "Q_NATU";
    if ((p === "BLOCAGE_EMPLOI" || p === "BLOCAGE_SIMPLE") && etat.emp === null) return "Q_EMPLOI";
    if (p === "PROCEDURE_EN_COURS" && etat.ech === undefined) return "Q_ECHEANCE";
    if (p === "DIAGNOSTIC" && etat.depuis !== "Q_DIAG" && !etat.q.trim()) return "Q_DIAG";
    if (AVEC_DATE.includes(p) && etat.depuis !== "DATE") {
      if (p === "REFUS_IMPLICITE" || etat.dref === undefined) return "DATE";
    }
    return "RESULTAT";
  }

  const etatCourant = (depuis: Etape) => ({
    p: procedure,
    sit: situation,
    visa: visaType,
    natu: natuIssue,
    emp: emploi,
    ech: echeance,
    q: question,
    dref: dateRef,
    ddem: dateDemande,
    depuis,
  });
  const avancer = (depuis: Etape, maj: Partial<ReturnType<typeof etatCourant>> = {}) =>
    setEtape(prochaine({ ...etatCourant(depuis), ...maj }));

  async function analyser(texte: string, liste: File[]) {
    setErreur(null);
    setEtape("ANALYSE");
    try {
      const images: { mime: string; base64: string }[] = [];
      const pdfs: { base64: string }[] = [];
      for (const f of liste) {
        const b = await enBase64(f);
        if (b.mime === "application/pdf") pdfs.push({ base64: b.base64 });
        else images.push(b);
      }
      const r = await fetch("/api/triage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recit: texte || undefined, images, pdfs }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur ?? t("Analyse impossible"));
      const tri: ResultatTriage = j.triage;
      setTriage(tri);
      if (j.refus) {
        setRefus(j.refus);
        return setEtape("REFUS");
      }
      const p = tri.procedure as CodeProcedure;
      setProcedure(p);
      const lue = tri.dateNotification ?? tri.dateDecision;
      setDateLue(lue);
      setDateDemande(tri.dateDemande);
      if (tri.nationaliteAlgerienne !== null) setAlgerien(tri.nationaliteAlgerienne);
      setVisaType(tri.visaType);
      setNatuIssue(tri.naturalisationIssue);
      // L'emploi menacé est toujours demandé explicitement (jamais deviné), comme la situation pour une OQTF.
      setEmploi(null);
      setEcheance(tri.dateEcheance ?? undefined);
      setEtape(
        prochaine({
          p,
          sit: null,
          visa: tri.visaType,
          natu: tri.naturalisationIssue,
          emp: null,
          ech: tri.dateEcheance ?? undefined,
          q: "",
          dref: undefined,
          ddem: tri.dateDemande,
          depuis: "ANALYSE",
        }),
      );
    } catch (e) {
      setErreur(e instanceof Error ? e.message : t("Analyse impossible"));
      setEtape("RECIT");
    }
  }

  async function creerPreDossier() {
    if (!procedure) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await fetch("/api/predossier", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          procedure,
          situationOQTF: situation,
          dateReference: dateRef ?? null,
          dateDemande,
          dateEcheance: echeance ?? null,
          recit: [recit, question].filter(Boolean).join("\n\nQuestion : ") || undefined,
          triage,
          avisPrealable,
          coordonnees: coord,
          algerien,
          consentRelances: consent,
          langue: triage?.langue ?? "fr",
          source,
          qualification: {
            visaType,
            naturalisationIssue: natuIssue,
            emploiMenace: emploi,
            question: question || null,
            silenceApresRecoursPrealable: apresRecours,
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur);
      setJeton(j.jeton);
      setReference(j.reference);
      // Avis préalable et diagnostic : questionnaire et pièces avant le paiement, rien n'est redemandé après (cahier des charges, 4.9).
      if (avisOuDiagnostic) setEtape(faits.length ? "FAITS" : "QUESTIONNAIRE");
      else setEtape("PAIEMENT");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : t("Une erreur est survenue."));
    } finally {
      setEnvoi(false);
    }
  }

  async function demanderProche() {
    if (!jeton) return;
    if (!caseConvention || !caseExecution) return setErreur(t("Cochez d'abord les deux cases : c'est vous qui acceptez la convention."));
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await fetch("/api/proche", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jeton, accepteConvention: true, executionImmediate: true }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur);
      setLienProche(j.lien);
      setEtape("PROCHE");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : t("Une erreur est survenue."));
    } finally {
      setEnvoi(false);
    }
  }

  // ---- Libellés calculés ----
  const contenu = procedure ? CONTENUS[procedure] : null;
  const titreProcedure = (() => {
    if (!procedure) return "";
    if (procedure === "REFUS_VISA" && visaType)
      return visaType === "LONG"
        ? "Recours devant la commission de recours contre les refus de visa"
        : "Recours préalable auprès du sous-directeur des visas";
    if (procedure === "NATURALISATION" && natuIssue === "AJOURNEMENT") return "Recours préalable contre un ajournement de naturalisation";
    if (procedure === "REFUS_IMPLICITE" && delai?.refusImpliciteNonNe) return "Demande restée sans réponse";
    return PROCEDURES[procedure].libelle;
  })();
  const libelleOffre = avisPrealable ? "Avis écrit d'un avocat" : titreProcedure;
  const demanderAlgerien =
    !!procedure && REGIME_ALGERIEN.includes(procedure) && (triage?.nationaliteAlgerienne ?? null) === null;
  const coordOk =
    coord.civilite &&
    coord.prenom.trim() &&
    coord.nom.trim() &&
    /\S+@\S+\.\S+/.test(coord.email) &&
    coord.telephone.replace(/\D/g, "").length >= 8 &&
    adresseComplete(coord) &&
    (!demanderAlgerien || algerien !== null);
  const obtenir = (triage?.ceQueLeRecoursPeutObtenir || contenu?.obtenir) ?? "";
  // Textes de l'IA : en français pour l'avocat ; traduits dans la langue du récit pour l'affichage, si c'est la langue de l'écran.
  const langueEcran = useLangue();
  const listePays = useMemo(
    () => PAYS.map((c) => [c, nomPays(c, langueEcran)] as const).sort((a, b) => (a[0] === "FR" ? -1 : b[0] === "FR" ? 1 : a[1].localeCompare(b[1], langueEcran))),
    [langueEcran],
  );
  const traductionIA = triage?.traduction && triage.traduction.langue === langueEcran ? triage.traduction : null;
  const obtenirAffiche =
    langueEcran === "fr" ? obtenir : (traductionIA?.obtenir ?? (contenu ? t(contenu.obtenir) : ""));
  const faitsAffiches = langueEcran === "fr" ? (triage?.faits ?? []) : (traductionIA?.faits ?? []);
  const avisOuDiagnostic = avisPrealable || procedure === "DIAGNOSTIC";
  const contexteQ = { procedure: procedure ?? "DIAGNOSTIC", algerien, avisOuDiagnostic };
  const faits = triage?.faits ?? [];
  const progression = (() => {
    const i = ETAPES_PROGRESSION.indexOf(etape);
    if (i >= 0) return i / (ETAPES_PROGRESSION.length - 1);
    return etape.startsWith("Q_") || etape === "DATE" ? 0.15 : 0.05;
  })();
  const donneesConvention = procedure
    ? {
        civilite: (coord.civilite || undefined) as "MADAME" | "MONSIEUR" | undefined,
        prenom: coord.prenom,
        nom: coord.nom,
        adresse: adresseEnLignes(coord).join(", ") || undefined,
        horsUE: !tvaApplicable(coord.pays),
        reference: reference ?? "—",
        procedureLibelle: libelleOffre,
        recoursPrealable: estRecoursPrealable(procedure) && !avisPrealable,
        lignes: offre,
        troisFois: fractionnable,
        dateLimite: delai?.dateLimite ? dateLongue(delai.dateLimite) : undefined,
      }
    : null;
  const suggestions = SUGGESTIONS.map((s) => t(s)).filter((s) => !recit.trim() || s.toLowerCase().includes(recit.trim().toLowerCase()));

  const pastille =
    delai?.dateLimite && delai.joursRestants !== undefined && !["EXPIRE", "REFUSE"].includes(delai.traitement) && etape !== "RECIT"
      ? joursPourAgir(delai.joursRestants, t)
      : null;

  // ---- Présentation : interface validée (démonstration « Encre ») ----
  const orientation = ["RECIT", "ANALYSE", "REFUS", "Q_SITUATION", "Q_VISA", "Q_NATU", "Q_EMPLOI", "Q_ECHEANCE", "Q_DIAG", "DATE", "RESULTAT"].includes(etape);
  useEffect(() => {
    document.body.classList.toggle("pay1", etape === "PAIEMENT");
    return () => document.body.classList.remove("pay1");
  }, [etape]);

  const ETAPES_FLUX = avisOuDiagnostic
    ? ["Situation", avisPrealable ? "L'avis d'un avocat" : "Votre diagnostic", "Vos coordonnées", "Votre dossier", "Paiement"]
    : ["Situation", "Votre recours", "Vos coordonnées", "Paiement"];
  const indexFlux = (() => {
    if (etape === "RECOURS") return 1;
    if (etape === "COORDONNEES") return 2;
    if (["FAITS", "QUESTIONNAIRE", "PIECES", "PRET"].includes(etape)) return 3;
    return ETAPES_FLUX.length - 1;
  })();
  const minutes = Math.max(1, (ETAPES_FLUX.length - indexFlux) * 2);
  const jours = delai?.joursRestants;
  const avecDelai = !!delai?.dateLimite && jours !== undefined && !["EXPIRE", "REFUSE"].includes(delai.traitement);
  const navProcedure = procedure ? t(PROCEDURES[procedure].libelle) : "";

  const blocDelai = (aside: boolean) =>
    avecDelai ? (
      <div className={`deadline ${urgence ? "urg" : ""}`}>
        {aside && (
          <span className="eyebrow" style={{ color: "#F6B3AC" }}>
            {t(procedure === "PROCEDURE_EN_COURS" ? "Prochaine échéance" : "Délai restant pour agir")}
          </span>
        )}
        <span className="n">
          {Math.max(jours!, 0)} <small>{t(jours === 1 ? "jour" : "jours")}</small>
        </span>
        <p>
          {t(procedure === "PROCEDURE_EN_COURS" ? "Prochaine échéance" : "Date limite")} : {dateLongue(delai!.dateLimite!)}.
          {aside ? " " + t("Déposez votre dossier sans attendre.") : ""}
        </p>
      </div>
    ) : null;

  const aside = (
    <div className="aside">
      {blocDelai(true)}
      <div className="box">
        <h4>{t("Votre dossier")}</h4>
        <div>
          <b>{t(libelleOffre)}</b>
        </div>
        {contenu && <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{t(contenu.instance)}</div>}
      </div>
      {(recit || question) && (
        <details className="box m-fold">
          <summary>
            <h4>{t("Ce que vous nous avez dit")}</h4>
          </summary>
          <div dir="auto" style={{ fontSize: 13.5, color: "var(--ink-2)", maxHeight: 140, overflow: "auto" }}>
            {recit || question}
          </div>
        </details>
      )}
      <div className="box trust">
        <h4>{t("Votre avocat")}</h4>
        <div>{t("Votre dossier est attribué à un avocat du cabinet, qui le prend en charge sous 48 heures ouvrées.")}</div>
        <div className="tr-l">
          <span className="av sm">RR</span>
          <span>{t("Cabinet dirigé par Me Rafik Rabia")}</span>
        </div>
      </div>
      <div className="box d-only">
        <h4>{t("Engagements")}</h4>
        <div>{t("Prise en charge par un avocat sous 48 heures ouvrées.")}</div>
        <div>{t("Honoraires présentés avant paiement.")}</div>
        <div>{t("Paiement en une ou trois fois.")}</div>
      </div>
    </div>
  );

  // Questions posées dans la carte de l'assistant (une à la fois).
  const question1 = (titre: string, aide: string | null, options: { v: string; l: string }[], choisir: (v: string) => void) => (
    <div className="oqreg oq-first">
      <b>{t(titre)}</b>
      {aide && <span className="fr-sub">{t(aide)}</span>}
      <div className="oq-opts">
        {options.map((o) => (
          <button key={o.v} onClick={() => choisir(o.v)}>
            {t(o.l)}
          </button>
        ))}
      </div>
    </div>
  );

  const champDate = (
    titre: string,
    aide: string,
    valeur: string | null | undefined,
    changer: (v: string | undefined) => void,
    valider: () => void,
    inconnu: () => void,
    extra?: React.ReactNode,
  ) => (
    <div className="dategate">
      <b>{t(titre)}</b>
      <span className="fr-sub">{t(aide)}</span>
      <div className="dg-row">
        <input type="date" value={valeur ?? ""} onChange={(e) => changer(e.target.value || undefined)} aria-label={t(titre)} />
        <button className="btn cta" disabled={!valeur} onClick={valider}>
          {t("Valider")}
        </button>
      </div>
      {extra}
      <button className="link" onClick={inconnu}>
        {t("Je ne connais pas la date")}
      </button>
    </div>
  );

  return (
    <>
      <EnteteParcours langue={etape === "RECIT"} />
      <main>
        {orientation ? (
          <div className="wrap tob">
            <section className="hero">
              <div>
                <div className="composer">
                  <p className="lx-ia">
                    {t("Vous échangez avec un outil d'intelligence artificielle du cabinet. Il oriente votre demande ; un avocat étudie ensuite votre dossier.")}
                  </p>
                  <label className="comp-q" htmlFor="tri_in">
                    {t("Qu'est-ce qui vous arrive ?")}
                  </label>
                  {etape !== "RECIT" && (recit || fichiers.length > 0) && (
                    <div className="thread">
                      {recit && (
                        <div className="tb u" dir="auto">
                          {recit}
                        </div>
                      )}
                      {fichiers.length > 0 && (
                        <div className="tb u">{t("{n} page(s) de décision transmise(s)", { n: fichiers.length })}</div>
                      )}
                    </div>
                  )}
                  {etape === "RECIT" && (
                    <>
                      <div className="comp-wrap">
                        <div className="comp-row">
                          <textarea
                            id="tri_in"
                            dir="auto"
                            rows={2}
                            value={recit}
                            placeholder={t("Décrivez votre situation…")}
                            onChange={(e) => setRecit(e.target.value)}
                            onFocus={() => setSuggestionsOuvertes(true)}
                            onBlur={() => setTimeout(() => setSuggestionsOuvertes(false), 150)}
                          />
                          <button className={`mic ${dicteeRecit.actif ? "rec" : ""}`} onClick={dicteeRecit.basculer} aria-label={t("Dicter")}>
                            <IconeMicro />
                          </button>
                        </div>
                        {suggestionsOuvertes && suggestions.length > 0 && recit.length < 40 && (
                          <div className="sugbox" role="listbox">
                            <div className="sg-h">{t("Situations courantes")}</div>
                            {suggestions.map((s) => (
                              <div
                                key={s}
                                className="sg"
                                role="option"
                                aria-selected={false}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setRecit(s);
                                  setSuggestionsOuvertes(false);
                                }}
                              >
                                {s}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button className="btn cta big tri-go" disabled={!recit.trim() && !fichiers.length} onClick={() => analyser(recit, fichiers)}>
                        {t("Continuer")}
                      </button>
                    </>
                  )}
                  <div className="comp-sub">
                    <span>{t("Toutes les langues, à l'écrit ou à la voix")}</span>
                    {etape !== "RECIT" && (
                      <button className="link" onClick={() => window.location.reload()}>
                        {t("Recommencer")}
                      </button>
                    )}
                  </div>
                  {etape === "RECIT" && (
                    <div className="dec-inv">
                      <button className="btn dec-btn cam" onClick={() => champFichier.current?.click()}>
                        <IconeImport />
                        <span className="ph-lm">{t("Photographier ma décision")}</span>
                        <span className="ph-ld">{t("Importer ma décision")}</span>
                      </button>
                      <span className="dec-h">
                        {t("Vous avez reçu une décision ? Photographiez-la ou importez-la : nous l'analysons pour vous. Plusieurs pages possibles.")}
                      </span>
                      {fichiers.length > 0 && (
                        <div className="vign">
                          {fichiers.map((f, i) => (
                            <span key={i}>
                              {t("Page {n}", { n: i + 1 })}
                              <button onClick={() => setFichiers((l) => l.filter((_, j) => j !== i))} aria-label={t("Retirer")}>
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <input
                    ref={champFichier}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    hidden
                    onChange={(e) => setFichiers((f) => [...f, ...Array.from(e.target.files ?? [])])}
                  />
                  {erreur && <p className="erreur" role="alert">{erreur}</p>}
                </div>
              </div>
            </section>

            {etape === "ANALYSE" && (
              <div className="triresult">
                <div className="think">
                  <span className="spin" />
                  {fichiers.length ? t("Nous lisons votre décision…") : t("Analyse de votre situation…")}
                </div>
              </div>
            )}

            {etape === "REFUS" && (
              <div className="triresult">
                <div className="tr-head">
                  <span className="pill ai">{t("Assistant IA")}</span>
                </div>
                <div className="urg">
                  <EcranRefus refus={refus} />
                </div>
              </div>
            )}

            {procedure && etape !== "RECIT" && etape !== "ANALYSE" && etape !== "REFUS" && (
              <div className="triresult">
                <div className="tr-head">
                  <span className="pill ai">{t("Assistant IA")}</span>
                </div>
                <p className="serif tr-msg">{t("Voici la procédure envisagée pour votre situation ; votre avocat la vérifie dès la prise en charge.")}</p>
                <div className="tr-proc">
                  <b>{t(titreProcedure)}</b>
                </div>

                {dateRef && etape === "RESULTAT" && (
                  <div className="dg-done">
                    <span>
                      {t("Décision reçue le")} <b>{dateLongue(isoVersDate(dateRef)!)}</b>
                    </span>
                    <button className="link" onClick={() => { setCorrection(true); setEtape("DATE"); }}>
                      {t("Modifier")}
                    </button>
                  </div>
                )}

                {etape === "Q_SITUATION" &&
                  question1("Où vous trouvez-vous aujourd'hui ?", "Votre situation fixe le délai pour contester l'OQTF.", SITUATIONS.map((s) => ({ v: s.v, l: s.l })), (v) => {
                    const sit = v as SituationOQTF;
                    setSituation(sit);
                    if (sit === "DETENTION" || sit === "RETENTION") {
                      setRefus(sit);
                      return setEtape("REFUS");
                    }
                    avancer("Q_SITUATION", { sit });
                  })}

                {etape === "Q_VISA" &&
                  question1(
                    "Quel visa avez-vous demandé ?",
                    "Le recours n'est pas adressé à la même autorité.",
                    [
                      { v: "COURT", l: "Un visa de court séjour (visite, tourisme, moins de 3 mois)" },
                      { v: "LONG", l: "Un visa de long séjour (conjoint, études, travail, famille)" },
                    ],
                    (v) => {
                      setVisaType(v as "COURT" | "LONG");
                      avancer("Q_VISA", { visa: v as "COURT" | "LONG" });
                    },
                  )}

                {etape === "Q_NATU" &&
                  question1(
                    "Qu'indique la décision ?",
                    null,
                    [
                      { v: "REFUS", l: "Ma demande est refusée" },
                      { v: "AJOURNEMENT", l: "Ma demande est ajournée (reportée)" },
                    ],
                    (v) => {
                      setNatuIssue(v as "REFUS" | "AJOURNEMENT");
                      avancer("Q_NATU", { natu: v as "REFUS" | "AJOURNEMENT" });
                    },
                  )}

                {etape === "Q_EMPLOI" &&
                  question1(
                    "Risquez-vous de perdre votre emploi ?",
                    "Par exemple : votre employeur ne peut plus vous garder sans récépissé valable.",
                    [
                      { v: "OUI", l: "Oui" },
                      { v: "NON", l: "Non" },
                    ],
                    (v) => {
                      const oui = v === "OUI";
                      setEmploi(oui);
                      const p: CodeProcedure = oui ? "BLOCAGE_EMPLOI" : "BLOCAGE_SIMPLE";
                      setProcedure(p);
                      setEtape(prochaine({ ...etatCourant("Q_EMPLOI"), p, emp: oui }));
                    },
                  )}

                {etape === "Q_ECHEANCE" &&
                  champDate(
                    "Quelle est la prochaine date fixée par le tribunal ?",
                    "Date limite pour produire un mémoire, ou date d'audience, indiquée dans le dernier courrier du tribunal.",
                    echeance,
                    (v) => setEcheance(v),
                    () => avancer("Q_ECHEANCE"),
                    () => {
                      setEcheance(null);
                      avancer("Q_ECHEANCE", { ech: null });
                    },
                  )}

                {etape === "Q_DIAG" && (
                  <div className="dategate">
                    <b>{t("Quelle question voulez-vous poser à l'avocat ?")}</b>
                    <span className="fr-sub">{t("En une ou deux phrases, ce que vous voulez savoir.")}</span>
                    <div className="vwrap ta">
                      <textarea dir="auto" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} aria-label={t("Votre question")} />
                      <button className={`fmic ${dicteeQuestion.actif ? "rec" : ""}`} onClick={dicteeQuestion.basculer} aria-label={t("Dicter")}>
                        <IconeMicro />
                      </button>
                    </div>
                    <div className="dg-row">
                      <button className="btn cta" disabled={!question.trim()} onClick={() => avancer("Q_DIAG")}>
                        {t("Valider")}
                      </button>
                    </div>
                  </div>
                )}

                {etape === "DATE" && procedure === "REFUS_IMPLICITE" &&
                  champDate(
                    "Quand avez-vous déposé votre demande ?",
                    "La date figure sur le récépissé de dépôt ou l'accusé de réception.",
                    dateDemande,
                    (v) => setDateDemande(v ?? null),
                    () => avancer("DATE"),
                    () => {
                      setDateDemande(null);
                      avancer("DATE", { ddem: null });
                    },
                    <label className="chk">
                      <input type="checkbox" checked={apresRecours} onChange={(e) => setApresRecours(e.target.checked)} />
                      {t("Il s'agit d'un recours déjà adressé à l'administration, resté sans réponse")}
                    </label>,
                  )}

                {etape === "DATE" && procedure !== "REFUS_IMPLICITE" && (
                  dateLue && !correction ? (
                    question1(
                      t("Vous avez reçu cette décision le {date} ?", { date: dateLongue(isoVersDate(dateLue)!) }),
                      "Date lue sur votre décision ou dans votre récit.",
                      [
                        { v: "OUI", l: "Oui, c'est exact" },
                        { v: "NON", l: "Non, je corrige" },
                      ],
                      (v) => {
                        if (v === "OUI") {
                          setDateRef(dateLue);
                          avancer("DATE", { dref: dateLue });
                        } else setCorrection(true);
                      },
                    )
                  ) : (
                    champDate(
                      "Quand avez-vous reçu la décision ?",
                      "Le jour où la lettre vous a été remise, ou où vous l'avez retirée à la poste.",
                      dateRef,
                      (v) => setDateRef(v),
                      () => avancer("DATE"),
                      () => {
                        setDateRef(null);
                        avancer("DATE", { dref: null });
                      },
                    )
                  )
                )}

                {etape === "RESULTAT" && delai && contenu && (
                  <>
                    {delai.refusImpliciteNonNe ? (
                      <div className="mini-q">
                        <p className="note">
                          {t("La préfecture a encore jusqu'au {date} pour répondre. Faute de réponse à cette date, son silence vaudra refus et pourra être contesté.", {
                            date: dateLongue(delai.refusImpliciteNonNe.dateNaissance),
                          })}
                        </p>
                        <p className="fr-sub">{t("D'ici là, un avocat peut étudier votre situation et vous dire quoi faire.")}</p>
                        <div className="tr-choice">
                          <button className="tc main" onClick={() => { setAvisPrealable(true); setEtape("RECOURS"); }}>
                            <b>{t("Recevoir l'avis écrit d'un avocat")} →</b>
                          </button>
                        </div>
                      </div>
                    ) : delai.traitement === "EXPIRE" ? (
                      <div className="mini-q">
                        <p className="note warn">
                          {t("D'après la date indiquée, le délai pour agir paraît dépassé. Il arrive souvent que la date retenue ne soit pas la bonne ; un avocat vérifie si un recours reste possible.")}
                        </p>
                        <div className="tr-choice">
                          <button className="tc main" onClick={() => { setAvisPrealable(true); setEtape("RECOURS"); }}>
                            <b>{t("Faire vérifier mon délai par un avocat (69 €)")}</b>
                          </button>
                          <button className="tc" onClick={() => { setCorrection(true); setEtape("DATE"); }}>
                            <b>{t("Corriger la date")}</b>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {blocDelai(false)}
                        {avecDelai && <p className="fr-sub">{t("Estimation à partir de la date indiquée ; elle sera confirmée à la lecture de votre décision.")}</p>}
                        {situation === "INCONNUE" && (
                          <p className="note">{t("Faute de connaître votre situation, nous retenons par prudence le délai le plus court (7 jours). Votre avocat vérifie le délai exact.")}</p>
                        )}
                        {delai.dateInconnue && procedure !== "PROCEDURE_EN_COURS" && (
                          <p className="note">{t("Sans la date de réception, votre avocat vérifie la date limite en priorité dès la prise en charge.")}</p>
                        )}
                        {urgence && (
                          <div className="urg">
                            <h3>{t("Procédure d'urgence")}</h3>
                            <p>
                              {t("Délai très court : votre avocat dépose d'abord une requête sommaire pour préserver le délai, puis la complète. Prise en charge sous 10 heures ouvrées ; le cabinet vous contacte si nécessaire.")}
                            </p>
                          </div>
                        )}
                        <div className="tr-choice">
                          <button className="tc main" onClick={() => setEtape("RECOURS")}>
                            <b>{t(procedure === "DIAGNOSTIC" ? "Continuer" : "Engager la procédure")} →</b>
                          </button>
                        </div>
                      </>
                    )}

                    {((obtenirAffiche && !delai.refusImpliciteNonNe) || faitsAffiches.length > 0) && (
                      <div className="sit-b">
                        <b className="sit-t">{t("Ce que nous avons retenu")}</b>
                        {obtenirAffiche && !delai.refusImpliciteNonNe && <p className="sit-v">{obtenirAffiche}</p>}
                        {faitsAffiches.length > 0 && (
                          <div className="sit-chips">
                            {faitsAffiches.map((f, i) => (
                              <span key={i}>✓ {f}</span>
                            ))}
                          </div>
                        )}
                        <small>{t("Information générale, pas une consultation : votre avocat étudie votre situation une fois la procédure engagée.")}</small>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="wrap">
            <div className="progress">
              <div className="pbar">
                <i style={{ width: `${Math.round(((indexFlux + 1) / ETAPES_FLUX.length) * 100)}%` }} />
              </div>
              <div className="pmeta">
                <span>
                  <b>{t("Étape {i} sur {n}", { i: indexFlux + 1, n: ETAPES_FLUX.length })}</b> · {t(ETAPES_FLUX[indexFlux])}
                </span>
                <span>
                  {t("≈ {m} min", { m: minutes })} · <span className="saved">✓ {t("enregistré")}</span>
                </span>
              </div>
            </div>
            <div className="stepper">
              {ETAPES_FLUX.map((e, i) => (
                <span key={e} className={i < indexFlux ? "done" : i === indexFlux ? "on" : ""}>
                  {i + 1}. {t(e)}
                </span>
              ))}
            </div>
            {avecDelai && etape !== "PAIEMENT" && (
              <div className="dlbar">
                <b>{joursPourAgir(jours!, t)}</b> · {t("date limite")} {dateLongue(delai!.dateLimite!)}
              </div>
            )}
            {erreur && <p className="erreur" role="alert">{erreur}</p>}

            <div className="flowgrid">
              <div>
                {etape === "RECOURS" && procedure && contenu && (
                  <div className="card off">
                    <h2>{t(avisPrealable ? "L'avis d'un avocat" : procedure === "DIAGNOSTIC" ? "Votre diagnostic" : "Votre recours")}</h2>
                    <p className="intro">{t(libelleOffre)}</p>
                    <div className="off-p">
                      <b>{formatEuros(total)}</b>
                      <span>
                        {t("TTC")}
                        {fractionnable && (
                          <>
                            <br />
                            <b className="x3">{t("ou 3 paiements de {montant} avec Klarna", { montant: formatEuros(echeances3[1]) })}</b>
                          </>
                        )}
                      </span>
                    </div>
                    {urgence && <p className="fr-sub">{t("Dont {montant} de prise en charge en urgence.", { montant: formatEuros(19_000) })}</p>}
                    <ul className="off-in">
                      {(avisPrealable
                        ? ["Un avocat du cabinet étudie votre dossier et vos documents", "Un avis écrit sous 48 heures ouvrées, avec la procédure conseillée", "69 € non déduits si la procédure est engagée ensuite"]
                        : contenu.compris
                      ).map((c) => (
                        <li key={c}>✓ {t(c)}</li>
                      ))}
                    </ul>
                    {!avisPrealable && contenu.nonCompris && <p className="note">{t(contenu.nonCompris)}</p>}
                    {!avisPrealable && procedure !== "DIAGNOSTIC" && <p className="ferme">{t("Prix ferme pour toute la mission décrite, sans supplément.")}</p>}
                    <div className="box">
                      <h4>{t("Après votre paiement")}</h4>
                      <ol className="apres">
                        {apresPaiement(urgence).map((a) => (
                          <li key={a}>{t(a)}</li>
                        ))}
                      </ol>
                    </div>
                    <div className="actions">
                      <button className="btn ghost" onClick={() => setEtape("RESULTAT")}>
                        {t("Retour")}
                      </button>
                      <button className="btn cta" onClick={() => setEtape("COORDONNEES")}>
                        {t("Continuer")}
                      </button>
                    </div>
                    {!avisPrealable && delai?.avisPossible && !["DIAGNOSTIC", "BLOCAGE_SIMPLE"].includes(procedure) && (
                      <button className="link off-alt" onClick={() => setAvisPrealable(true)}>
                        {t("Je préfère d'abord l'avis écrit d'un avocat (69 €)")}
                      </button>
                    )}
                    {avisPrealable && delai && delai.traitement !== "EXPIRE" && !delai.refusImpliciteNonNe && (
                      <button className="link off-alt" onClick={() => setAvisPrealable(false)}>
                        {t("Engager directement la procédure")}
                      </button>
                    )}
                  </div>
                )}

                {etape === "COORDONNEES" && (
                  <div className="card q1">
                    <div className="q1-top">
                      <span className="q1-sec">{t("Vos coordonnées")}</span>
                    </div>
                    <div className="fields q1-f">
                      <div className="f full">
                        <label>{t("Civilité")} *</label>
                        <div className="yn">
                          {(["MADAME", "MONSIEUR"] as const).map((c) => (
                            <button key={c} className={coord.civilite === c ? "sel" : ""} onClick={() => setCoord({ ...coord, civilite: c })}>
                              {t(c === "MADAME" ? "Madame" : "Monsieur")}
                            </button>
                          ))}
                        </div>
                        <span className="help">{t("Pour rédiger correctement vos actes et votre attestation.")}</span>
                      </div>
                      <div className="f">
                        <label htmlFor="q_prenom">{t("Prénom")} *</label>
                        <input id="q_prenom" type="text" autoComplete="given-name" value={coord.prenom} onChange={(e) => setCoord({ ...coord, prenom: e.target.value })} />
                      </div>
                      <div className="f">
                        <label htmlFor="q_nom">{t("Nom")} *</label>
                        <input id="q_nom" type="text" autoComplete="family-name" value={coord.nom} onChange={(e) => setCoord({ ...coord, nom: e.target.value })} />
                      </div>
                      <div className="f">
                        <label htmlFor="q_email">{t("E-mail")} *</label>
                        <input id="q_email" type="email" inputMode="email" autoComplete="email" value={coord.email} onChange={(e) => setCoord({ ...coord, email: e.target.value })} />
                      </div>
                      <div className="f">
                        <label htmlFor="q_tel">{t("Téléphone")} *</label>
                        <input id="q_tel" type="tel" inputMode="tel" autoComplete="tel" value={coord.telephone} onChange={(e) => setCoord({ ...coord, telephone: e.target.value })} />
                      </div>
                      <div className="f full">
                        <label htmlFor="q_adresse">{t("Adresse postale")} *</label>
                        <input id="q_adresse" type="text" autoComplete="street-address" value={coord.adresse} onChange={(e) => setCoord({ ...coord, adresse: e.target.value })} />
                        <span className="help">{t("Elle figure sur votre facture, votre convention d'honoraires et vos actes.")}</span>
                      </div>
                      <div className="f">
                        <label htmlFor="q_cp">
                          {t("Code postal")}
                          {coord.pays === "FR" ? " *" : ""}
                        </label>
                        <input id="q_cp" type="text" inputMode={coord.pays === "FR" ? "numeric" : "text"} autoComplete="postal-code" value={coord.codePostal} onChange={(e) => setCoord({ ...coord, codePostal: e.target.value })} />
                      </div>
                      <div className="f">
                        <label htmlFor="q_ville">{t("Ville")} *</label>
                        <input id="q_ville" type="text" autoComplete="address-level2" value={coord.ville} onChange={(e) => setCoord({ ...coord, ville: e.target.value })} />
                      </div>
                      <div className="f full">
                        <label htmlFor="q_pays">{t("Pays")} *</label>
                        <select id="q_pays" autoComplete="country" value={coord.pays} onChange={(e) => setCoord({ ...coord, pays: e.target.value })}>
                          {listePays.map(([code, nom]) => (
                            <option key={code} value={code}>
                              {nom}
                            </option>
                          ))}
                        </select>
                      </div>
                      {coord.pays === "FR" && coord.codePostal.trim() !== "" && !/^\d{5}$/.test(coord.codePostal.trim()) && (
                        <p className="erreur full">{t("Code postal : 5 chiffres.")}</p>
                      )}
                      {demanderAlgerien && (
                        <div className="f full">
                          <label>{t("Êtes-vous de nationalité algérienne ?")} *</label>
                          <div className="yn">
                            <button className={algerien === true ? "sel" : ""} onClick={() => setAlgerien(true)}>
                              {t("Oui")}
                            </button>
                            <button className={algerien === false ? "sel" : ""} onClick={() => setAlgerien(false)}>
                              {t("Non")}
                            </button>
                          </div>
                          <span className="help">{t("Les ressortissants algériens relèvent de l'accord franco-algérien de 1968 : votre procédure en tient compte.")}</span>
                        </div>
                      )}
                    </div>
                    <label className="chk rel">
                      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                      {t("J'accepte d'être relancé(e) par SMS ou e-mail si je ne termine pas mon dépôt.")}
                    </label>
                    <div className="actions">
                      <button className="btn ghost" onClick={() => setEtape("RECOURS")}>
                        {t("Retour")}
                      </button>
                      <button className="btn cta" disabled={!coordOk || envoi} onClick={creerPreDossier}>
                        {t(avisOuDiagnostic ? "Continuer" : "Continuer vers le paiement")}
                      </button>
                    </div>
                  </div>
                )}

                {etape === "FAITS" && jeton && (
                  <div className="card">
                    <ConfirmationFaits jeton={jeton} faits={faits} suite={() => setEtape("QUESTIONNAIRE")} />
                  </div>
                )}
                {etape === "QUESTIONNAIRE" && jeton && procedure && (
                  <div className="card">
                    <QuestionnaireEcrans
                      jeton={jeton}
                      contexte={contexteQ}
                      reponsesInitiales={reponses}
                      suite={(r) => {
                        setReponses(r);
                        setEtape("PIECES");
                      }}
                    />
                  </div>
                )}
                {etape === "PIECES" && jeton && procedure && (
                  <div className="card">
                    <DepotPieces jeton={jeton} contexte={contexteQ} reponses={reponses} suite={() => setEtape("PRET")} />
                  </div>
                )}
                {etape === "PRET" && (
                  <div className="card">
                    <div className="succ">
                      <span className="succ-i" aria-hidden>
                        ✓
                      </span>
                      <div>
                        <b>{t("Votre avocat dispose des éléments nécessaires à l'appréciation de votre situation.")}</b>
                        <span>{t("Il ne reste qu'à valider pour recevoir son avis écrit sous 48 heures ouvrées.")}</span>
                      </div>
                    </div>
                    <div className="actions">
                      <button className="btn ghost" onClick={() => setEtape("PIECES")}>
                        {t("Retour")}
                      </button>
                      <button className="btn cta" onClick={() => setEtape("PAIEMENT")}>
                        {t("Valider")}
                      </button>
                    </div>
                  </div>
                )}

                {etape === "PAIEMENT" && donneesConvention && jeton && (
                  <div className="card p1 lx-p1">
                    <h2>{t("Valider et payer")}</h2>
                    <div className="p1-law lx-team">
                      <div className="lw lx-av">
                        {EQUIPE.map((a) => (
                          <span key={a.nom} className="av" title={a.nom} style={a.photo ? { overflow: "hidden", padding: 0 } : undefined}>
                            {a.photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", display: "block" }} />
                            ) : (
                              a.initiales
                            )}
                          </span>
                        ))}
                      </div>
                      <div>
                        <b>{t("Un avocat du cabinet accepte votre dossier, puis vous écrit.")}</b>
                        <span>
                          {t(urgence ? "Un avocat du cabinet prend votre dossier sous 10 heures ouvrées." : "Un avocat du cabinet prend votre dossier sous 48 heures ouvrées.")}{" "}
                          {t("Avocats au barreau de Paris : {noms}.", { noms: EQUIPE.map((a) => a.nom).join(", ") })}
                        </span>
                      </div>
                    </div>
                    <div className="p1-kv">
                      <div>
                        <span>{t(avisPrealable ? "Prestation" : "Procédure envisagée")}</span>
                        <b>{t(libelleOffre)}</b>
                      </div>
                      {delai?.dateLimite && !avisPrealable && (
                        <div>
                          <span>{t(procedure === "PROCEDURE_EN_COURS" ? "Prochaine échéance" : "Date limite estimée")}</span>
                          <b>{dateLongue(delai.dateLimite)}</b>
                        </div>
                      )}
                      <div>
                        <span>{tvaApplicable(coord.pays) ? t("Honoraires TTC") : t("Honoraires (TVA non applicable)")}</span>
                        <b>{formatEuros(total)}</b>
                      </div>
                    </div>
                    {fractionnable && (
                      <div className="p1-seg" role="group" aria-label={t("Mode de règlement")}>
                        <button className={!troisFoisChoisi ? "on" : ""} onClick={() => setTroisFoisChoisi(false)}>
                          {t("En une fois")}
                          <small>{formatEuros(total)}</small>
                        </button>
                        <button className={troisFoisChoisi ? "on" : ""} onClick={() => setTroisFoisChoisi(true)}>
                          {t("En 3 fois")}
                          <small>{t("3 × {montant} avec Klarna", { montant: formatEuros(echeances3[1]) })}</small>
                        </button>
                      </div>
                    )}
                    <div className="p1-conv">
                      <b>{t("Convention d'honoraires, en résumé")}</b>
                      <ul>
                        {langueEcran !== "fr" && <li>{t("La convention d'honoraires est rédigée en français.")}</li>}
                        {resumeConvention(donneesConvention).map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                      <span className="lx-links">
                        <button className="link" onClick={() => setVoirConvention(true)}>
                          {t("Lire la convention complète")}
                        </button>
                      </span>
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
                      total={total}
                      troisFois={troisFoisChoisi}
                      verifier={() => (!caseConvention || !caseExecution ? t("Cochez les deux cases ci-dessus pour payer.") : null)}
                      ouvrir={async () => {
                        const r = await fetch("/api/paiement", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ jeton, accepteConvention: true, executionImmediate: true }),
                        });
                        const j = await r.json();
                        if (!r.ok) throw new Error(j.erreur);
                        return j;
                      }}
                      urlRetour={(ref) => `${window.location.origin}/depot/merci?ref=${encodeURIComponent(ref)}`}
                    />
                    <button className="btn ghost lien-proche" disabled={envoi} onClick={demanderProche}>
                      {t("Faire régler par un proche")}
                    </button>
                    <p className="p1-sec">{t("Paiement sécurisé 3-D Secure (Stripe)")}</p>
                    <p className="p1-med">{t("Contestation des honoraires : Bâtonnier de l'Ordre des avocats de Paris.")}{" "}
                      {t("En cas de litige, vous pouvez saisir le médiateur de la consommation de la profession d'avocat.")}</p>
                    <div className="flow-nav">
                      <button className="btn ghost" onClick={() => setEtape(avisOuDiagnostic ? "PRET" : "COORDONNEES")}>
                        {t("Retour")}
                      </button>
                    </div>
                  </div>
                )}

                {etape === "PROCHE" && lienProche && (
                  <div className="card">
                    <EcranProche lien={lienProche} reference={reference ?? ""} total={total} prenom={coord.prenom} />
                  </div>
                )}
              </div>
              {etape !== "PAIEMENT" && aside}
            </div>
          </div>
        )}

        {voirConvention && donneesConvention && (
          <div className="overlay" role="dialog" aria-modal onClick={() => setVoirConvention(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="mhead">
                <h3>{t("Convention d'honoraires")}</h3>
                <button className="btn sm ghost" onClick={() => setVoirConvention(false)}>
                  {t("Fermer")}
                </button>
              </div>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--body)", fontSize: 14 }}>{texteConvention(donneesConvention)}</pre>
            </div>
          </div>
        )}

        {motifOuvert && (
          <div className="overlay" role="dialog" aria-modal onClick={() => setMotifOuvert(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
              <b>{t("Qu'est-ce qui vous fait hésiter ? (facultatif)")}</b>
              <div className="oq-opts">
                {(
                  [
                    ["TROP_CHER", "C'est trop cher"],
                    ["REFLECHIR", "Je veux réfléchir"],
                    ["PARLER", "Je préfère parler à quelqu'un"],
                  ] as const
                ).map(([m, l]) => (
                  <button
                    key={m}
                    onClick={() => {
                      void mesurer({ etape: "ABANDON_PRIX", motif: m });
                      setMotifOuvert(false);
                    }}
                  >
                    {t(l)}
                  </button>
                ))}
              </div>
              <button className="link" onClick={() => { setMotifOuvert(false); setEtape("RECOURS"); }}>
                {t("Revenir à mon recours")}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

const EQUIPE = [
  { nom: "Me Rafik Rabia", photo: "/avocats/rafik-rabia.jpg", initiales: "RR" },
  { nom: "Me Ahlem Ben Abderrazak", photo: "/avocats/ahlem-ben-abderrazak.jpg", initiales: "AB" },
  { nom: "Me Boualem Kachi", photo: null, initiales: "BK" },
  { nom: "Me Mohamed Khamlichi", photo: "/avocats/mohamed-khamlichi.jpg", initiales: "MK" },
];

function IconeImport() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

function EcranRefus({ refus }: { refus: Refus | null }) {
  const t = useT();
  const tel = useContenus().config.telephoneCabinet;
  if (refus === "HORS_PERIMETRE")
    return (
      <>
        <h1>{t("Nous ne pouvons pas prendre ce dossier en ligne")}</h1>
        <p>
          {t(
            "Votre situation ne relève pas des recours traités sur cette plateforme (asile, admission exceptionnelle au séjour ou procédure devant le juge judiciaire). Un avocat ou une association de votre région pourra vous orienter.",
          )}
        </p>
      </>
    );
  if (refus === "RETENTION")
    return (
      <>
        <h1>{t("Le dépôt en ligne n'est pas possible depuis un centre de rétention")}</h1>
        <p>{t("Le délai pour contester est de 48 heures. Adressez-vous sans attendre à l'association présente dans le centre, ou à un avocat.")}</p>
      </>
    );
  return (
    <>
      <h1>{t("Le dépôt en ligne n'est pas possible pour une personne détenue")}</h1>
      <p>
        {t(
          "La personne détenue ne peut ni utiliser la plateforme ni y signer sa convention. Le délai pour contester est très court : appelez le cabinet sans attendre, ou adressez-vous au point d'accès au droit de l'établissement. Aucun paiement n'est demandé en ligne.",
        )}
      </p>
      {tel && (
        <p>
          <a className="btn btn-encre large" href={`tel:${tel.replace(/\s/g, "")}`}>
            {t("Appeler le cabinet : {tel}", { tel })}
          </a>
        </p>
      )}
    </>
  );
}

function EcranProche({ lien, reference, total, prenom }: { lien: string; reference: string; total: number; prenom: string }) {
  const t = useT();
  const [copie, setCopie] = useState(false);
  const message = t("Bonjour, peux-tu régler mes honoraires d'avocat ({montant}, dossier {reference}) ? Le lien sécurisé : {lien}", {
    montant: formatEuros(total),
    reference,
    lien,
  });
  return (
    <>
      <h1>{t("Envoyez le lien à votre proche")}</h1>
      <p className="aide">
        {t(
          "Votre dossier {reference} reste à votre nom. Votre proche voit seulement la référence, la procédure, le montant et votre nom ; jamais votre récit ni vos documents. Vous serez prévenu dès le règlement.",
          { reference },
        )}
        {prenom ? "" : ""}
      </p>
      <div className="choix">
        <a className="btn btn-action large" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
          {t("Envoyer par WhatsApp")}
        </a>
        <a className="btn btn-encre large" href={`sms:?&body=${encodeURIComponent(message)}`}>
          {t("Envoyer par SMS")}
        </a>
        <button
          className="btn btn-contour large"
          onClick={async () => {
            await navigator.clipboard.writeText(lien);
            setCopie(true);
          }}
        >
          {copie ? t("Lien copié") : t("Copier le lien")}
        </button>
      </div>
      <p className="petite">{t("Le lien est valable 14 jours. Pensez à votre date limite : le dossier n'est pris en charge qu'une fois réglé.")}</p>
    </>
  );
}

function IconeMicro() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
