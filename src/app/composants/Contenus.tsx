"use client";
// Contenus modifiables au back office (tarifs, FAQ, avocats, accueil), transmis par le serveur aux composants du navigateur.
import { createContext, useContext, type ReactNode } from "react";
import { CONTENUS_DEFAUT, type ContenusPublics } from "@/lib/parametres";

const Contexte = createContext<ContenusPublics>(CONTENUS_DEFAUT);

export function FournisseurContenus({ valeur, children }: { valeur: ContenusPublics; children: ReactNode }) {
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export const useContenus = () => useContext(Contexte);
