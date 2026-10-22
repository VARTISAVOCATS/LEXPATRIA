import { randomBytes } from "node:crypto";

/** Identifiant opaque, non devinable (24 caractères base32). */
export function createId(): string {
  const alpha = "abcdefghijklmnopqrstuvwxyz234567";
  const b = randomBytes(15);
  let s = "";
  for (let i = 0; i < 24; i++) s += alpha[(b[Math.floor((i * 5) / 8)] >> ((i * 5) % 8)) & 31];
  return s;
}
