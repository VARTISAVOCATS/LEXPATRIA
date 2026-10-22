// Outils communs aux intégrations du lot 5 : appels HTTP avec délai, trace de la dernière exécution.
// Chaque intégration est inactive tant que ses paramètres ne sont pas saisis (back office › Connexions) :
// la plateforme fonctionne alors sans elle, et rien n'est envoyé à l'extérieur.

import type { Base } from "@/db";
import { synchronisations } from "@/db/schema";

export class ErreurIntegration extends Error {}

export async function appelJson<T = unknown>(url: string, init: RequestInit = {}, delaiMs = 20_000): Promise<T> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(delaiMs) });
  const texte = await r.text();
  if (!r.ok) throw new ErreurIntegration(`${new URL(url).host} a répondu ${r.status}${texte ? ` : ${texte.slice(0, 300)}` : ""}`);
  return (texte ? JSON.parse(texte) : {}) as T;
}

export async function tracer(d: Base, service: string, ok: boolean, message: string) {
  const le = new Date();
  await d
    .insert(synchronisations)
    .values({ service, le, ok, message: message.slice(0, 500) })
    .onConflictDoUpdate({ target: synchronisations.service, set: { le, ok, message: message.slice(0, 500) } });
}

export const messageErreur = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);
