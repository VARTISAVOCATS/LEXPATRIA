// Jeton signé permettant au navigateur de poursuivre un pré-dossier sans compte (avant paiement).
// Il ne donne accès qu'au parcours de dépôt de ce dossier, jamais à l'espace client.

import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.SECRET_JETONS;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SECRET_JETONS manquant");
  return s ?? "developpement-uniquement";
}

/** `usage` distingue les jetons du dépôt (client) et de règlement (proche) : l'un ne vaut pas l'autre. */
export function signer(dossierId: string, dureeH = 72, usage = "depot"): string {
  const exp = Math.floor(Date.now() / 1000) + dureeH * 3600;
  const charge = `${dossierId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(`${usage}:${charge}`).digest("base64url");
  return `${charge}.${sig}`;
}

export function verifier(jeton: string, usage = "depot"): string | null {
  const [id, exp, sig] = jeton.split(".");
  if (!id || !exp || !sig) return null;
  const attendu = createHmac("sha256", secret()).update(`${usage}:${id}.${exp}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(attendu);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return id;
}
