// Cadre commun de l'espace cabinet : en-tête, navigation, connexion obligatoire.
import Link from "next/link";
import type { ReactNode } from "react";
import { db } from "@/db";
import { compterAvisARendre, questionsEnAttente } from "@/lib/serveur/agenda";
import { membreConnecte, type Membre } from "@/lib/serveur/session";
import Connexion from "../composants/Connexion";
import { EnteteEspace } from "../composants/Entete";

const ROLES: Record<string, string> = { ASSOCIE: "Associé", AVOCAT: "Avocat", SECRETARIAT: "Secrétariat", CONFRERE_LOCAL: "Confrère" };

export async function Cadre({ actif, children }: { actif: string; children: (m: Membre) => ReactNode }) {
  const m = await membreConnecte();
  let nQuestions = 0;
  let nAvis = 0;
  if (m) {
    const d = await db();
    [nQuestions, nAvis] = await Promise.all([questionsEnAttente(d, m).then((q) => q.length), compterAvisARendre(d, m)]);
  }
  const onglets: [string, string, string, number?][] = [
    ["journee", "Ma journée", "/avocat"],
    ["dossiers", "Dossiers", "/avocat/dossiers"],
    ["agenda", "Agenda", "/avocat/agenda"],
    ["questions", "Questions", "/avocat/questions", nQuestions],
    ["consultations", "Consultations", "/avocat/consultations", nAvis],
  ];
  if (m?.role === "ASSOCIE") onglets.push(["indicateurs", "Indicateurs", "/avocat/indicateurs"], ["backoffice", "Back office", "/avocat/back-office"]);
  return (
    <>
      <EnteteEspace
        espace="EQUIPE"
        sousTitre="Espace cabinet"
        accueil="/avocat"
        connecte={!!m}
        nom={m ? `${m.role === "SECRETARIAT" ? "" : "Me "}${m.prenom} ${m.nom} · ${ROLES[m.role]}` : undefined}
      />
      <main className="esp cab">
        <div className="wrap">
          {!m ? (
            <Connexion espace="EQUIPE" titre="Espace cabinet" intro="Réservé aux avocats et au secrétariat du cabinet. Un code de connexion vous est envoyé sur votre adresse professionnelle." />
          ) : (
            <>
              <nav className="tabs esp-tabs" aria-label="Espace cabinet">
                {onglets.map(([k, l, h, n]) => (
                  <Link key={k} href={h} className={k === actif ? "on" : ""} aria-current={k === actif ? "page" : undefined}>
                    {l}
                    {!!n && <span className="cnt">{n}</span>}
                  </Link>
                ))}
              </nav>
              {children(m)}
            </>
          )}
        </div>
      </main>
    </>
  );
}
