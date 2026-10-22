// Cadre commun de l'espace cabinet : en-tête, navigation, connexion obligatoire.
import Link from "next/link";
import type { ReactNode } from "react";
import { membreConnecte, type Membre } from "@/lib/serveur/session";
import Connexion from "../composants/Connexion";
import { EnteteEspace } from "../composants/Entete";

const ROLES: Record<string, string> = { ASSOCIE: "Associé", AVOCAT: "Avocat", SECRETARIAT: "Secrétariat", CONFRERE_LOCAL: "Confrère" };

export async function Cadre({ actif, children }: { actif: string; children: (m: Membre) => ReactNode }) {
  const m = await membreConnecte();
  const onglets: [string, string, string][] = [
    ["journee", "Ma journée", "/avocat"],
    ["dossiers", "Dossiers", "/avocat/dossiers"],
    ["disponibilites", "Disponibilités", "/avocat/disponibilites"],
  ];
  if (m?.role === "ASSOCIE") onglets.push(["backoffice", "Back office", "/avocat/back-office"]);
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
                {onglets.map(([k, l, h]) => (
                  <Link key={k} href={h} className={k === actif ? "on" : ""} aria-current={k === actif ? "page" : undefined}>
                    {l}
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
