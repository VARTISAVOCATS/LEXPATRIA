// Sessions des espaces client et cabinet : cookie signé (HMAC), HttpOnly, 12 heures.
// Espace client : la session porte l'adresse e-mail (tous les dossiers de cette adresse).
// Espace cabinet : la session porte l'identifiant de l'utilisateur ; ses droits sont relus en base à chaque requête.

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { utilisateurs } from "@/db/schema";
import { signer, verifier } from "@/lib/jeton";

export type Espace = "CLIENT" | "EQUIPE";
const NOM: Record<Espace, string> = { CLIENT: "lx_client", EQUIPE: "lx_equipe" };
const USAGE: Record<Espace, string> = { CLIENT: "session-client", EQUIPE: "session-equipe" };
const DUREE_H = 12;

const encoder = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const decoder = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export async function ouvrirSession(espace: Espace, sujet: string) {
  const c = await cookies();
  c.set(NOM[espace], signer(encoder(sujet), DUREE_H, USAGE[espace]), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_H * 3600,
  });
}

export async function fermerSession(espace: Espace) {
  (await cookies()).delete(NOM[espace]);
}

async function sujet(espace: Espace): Promise<string | null> {
  const v = (await cookies()).get(NOM[espace])?.value;
  if (!v) return null;
  const s = verifier(v, USAGE[espace]);
  return s ? decoder(s) : null;
}

/** Adresse e-mail du client connecté, ou null. */
export async function clientConnecte(): Promise<string | null> {
  return sujet("CLIENT");
}

/** Membre de l'équipe connecté (actif), ou null. */
export async function membreConnecte() {
  const id = await sujet("EQUIPE");
  if (!id) return null;
  const d = await db();
  const [u] = await d.select().from(utilisateurs).where(eq(utilisateurs.id, id));
  return u && u.actif ? u : null;
}

export type Membre = NonNullable<Awaited<ReturnType<typeof membreConnecte>>>;
export const estAssocie = (m: Membre) => m.role === "ASSOCIE";
export const estAvocat = (m: Membre) => m.role === "ASSOCIE" || m.role === "AVOCAT";
