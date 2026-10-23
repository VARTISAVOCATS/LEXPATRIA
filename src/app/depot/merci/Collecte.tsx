"use client";

// Collecte après paiement (cahier des charges, 4.10, 5.3, 6.0 et 6.2), enchaînée sur la page « Paiement validé » :
// d'abord ce dont l'avocat a besoin pour agir (décision, enveloppe, identité), puis les faits du récit à confirmer,
// le questionnaire (« Je compléterai plus tard » possible) et les autres pièces. Rien ne bloque : chaque écran est passable.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { piecesDemandees, type Contexte, type Reponses } from "@/lib/questionnaire";
import { ConfirmationFaits, DepotPieces, QuestionnaireEcrans } from "../Questionnaire";

// Ce qui permet à l'avocat de commencer, selon la procédure ; le reste vient après le questionnaire.
// Ordre d'utilité : la pièce qui fonde le recours d'abord, l'identité en dernier.
const ESSENTIEL = ["DECISION", "ENVELOPPE", "BLOCAGE", "DEMANDE_DEPOSEE", "ECRITURES", "COURRIERS_TRIBUNAL", "IDENTITE"];
const estEssentiel = (type: string) => ESSENTIEL.includes(type);
const estAutre = (type: string) => !ESSENTIEL.includes(type);

type Phase = "ESSENTIEL" | "FAITS" | "QUESTIONNAIRE" | "AUTRES" | "FIN";

export default function Collecte({
  reference,
  jetonServeur,
  contexte,
  reponsesInitiales,
  faits,
}: {
  reference: string;
  jetonServeur: string | null;
  contexte: Contexte;
  reponsesInitiales: Reponses;
  faits: string[];
}) {
  const t = useT();
  const [jeton, setJeton] = useState<string | null>(jetonServeur);
  const [pret, setPret] = useState(!!jetonServeur);
  const [phase, setPhase] = useState<Phase>("ESSENTIEL");
  const [reponses, setReponses] = useState<Reponses>(reponsesInitiales);

  useEffect(() => {
    if (jetonServeur) return;
    try {
      setJeton(sessionStorage.getItem(`lexpatria-jeton:${reference}`));
    } catch {
      /* stockage indisponible */
    }
    setPret(true);
  }, [jetonServeur, reference]);

  useEffect(() => {
    if (phase !== "ESSENTIEL") window.scrollTo({ top: 0 });
  }, [phase]);

  if (!pret) return null;
  if (!jeton)
    return (
      <>
        <p>{t("Transmettez vos documents depuis le lien reçu par e-mail ou depuis votre espace.")}</p>
        <Link href="/espace" className="btn btn-action large">
          {t("Ajouter mes documents")}
        </Link>
      </>
    );

  const autres = piecesDemandees(contexte, reponses).some((p) => estAutre(p.type));
  const ordre: Phase[] = ["ESSENTIEL", ...(faits.length ? (["FAITS"] as Phase[]) : []), "QUESTIONNAIRE", ...(autres ? (["AUTRES"] as Phase[]) : []), "FIN"];
  const pourcent = Math.round((ordre.indexOf(phase) / (ordre.length - 1)) * 100);
  const apres = (p: Phase) => setPhase(ordre[Math.min(ordre.indexOf(p) + 1, ordre.length - 1)]);

  return (
    <div className="collecte">
      <div className="jauge" aria-label={t("Votre dossier est prêt à {p} %", { p: pourcent })}>
        <span>{t("Votre dossier est prêt à {p} %", { p: pourcent })}</span>
        <div className="pbar">
          <i style={{ width: `${pourcent}%` }} />
        </div>
      </div>

      {phase === "ESSENTIEL" && (
        <DepotPieces
          jeton={jeton}
          contexte={contexte}
          reponses={reponses}
          filtre={estEssentiel}
          ordre={ESSENTIEL}
          titre="Pour commencer sans attendre"
          suite={() => apres("ESSENTIEL")}
        />
      )}
      {phase === "FAITS" && <ConfirmationFaits jeton={jeton} faits={faits} suite={() => apres("FAITS")} />}
      {phase === "QUESTIONNAIRE" && (
        <QuestionnaireEcrans
          jeton={jeton}
          contexte={contexte}
          reponsesInitiales={reponses}
          suite={(r) => {
            setReponses(r);
            // La liste des autres pièces dépend des réponses qui viennent d'être données.
            setPhase(piecesDemandees(contexte, r).some((p) => estAutre(p.type)) ? "AUTRES" : "FIN");
          }}
          plusTard={() => apres("QUESTIONNAIRE")}
        />
      )}
      {phase === "AUTRES" && (
        <DepotPieces
          jeton={jeton}
          contexte={contexte}
          reponses={reponses}
          filtre={estAutre}
          titre="Vos autres documents"
          libelleSuite="Terminer"
          suite={() => apres("AUTRES")}
        />
      )}
      {phase === "FIN" && (
        <>
          <div className="succ">
            <span className="succ-i" aria-hidden>
              ✓
            </span>
            <div>
              <b>{t("Merci, votre dossier est transmis.")}</b>
              <span>{t("Vous pourrez ajouter un document à tout moment depuis votre espace.")}</span>
            </div>
          </div>
          <Link href="/espace" className="btn btn-action large">
            {t("Accéder à mon espace")}
          </Link>
        </>
      )}
    </div>
  );
}
