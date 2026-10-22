"use client";

import { useRef, useState } from "react";

interface Reconnaissance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

/** Bouton de dictée, pour tout champ de texte libre (cahier des charges : dictée sur chaque champ de récit). */
export function useDictee(valeur: string, changer: (v: string) => void, signalerErreur: (m: string) => void) {
  const [actif, setActif] = useState(false);
  const reco = useRef<Reconnaissance | null>(null);
  function basculer() {
    type Ctor = new () => Reconnaissance;
    const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
    const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!C) return signalerErreur("La dictée n'est pas disponible sur ce navigateur : écrivez votre texte.");
    if (actif) return reco.current?.stop();
    const r = new C();
    r.lang = navigator.language || "fr-FR";
    r.interimResults = false;
    r.continuous = true;
    const base = valeur ? valeur + " " : "";
    r.onresult = (e) => changer(base + Array.from(e.results).map((x) => x[0].transcript).join(" "));
    r.onend = () => setActif(false);
    reco.current = r;
    setActif(true);
    r.start();
  }
  return { actif, basculer };
}

