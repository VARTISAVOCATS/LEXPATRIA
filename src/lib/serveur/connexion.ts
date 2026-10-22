// Connexion par code à usage unique envoyé par e-mail (espace client et espace cabinet).
// Réponse identique que l'adresse soit connue ou non (aucune information sur l'existence d'un compte).
// Code de 6 chiffres, haché, valable 10 minutes, 5 essais au plus.

import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { Base } from "@/db";
import { clients, codesConnexion, dossiers, utilisateurs } from "@/db/schema";
import { journaliser } from "@/lib/journal";
import { envoyer } from "./notifications";
import type { Espace } from "./session";

const VALIDITE_MIN = 10;
const ESSAIS_MAX = 5;
const hacher = (code: string) => createHash("sha256").update(code).digest("hex");
export const normaliser = (email: string) => email.trim().toLowerCase();

/** Envoie un code si l'adresse est connue. Retourne le code en clair hors production (essais), jamais en production. */
export async function demanderCode(d: Base, espace: Espace, emailBrut: string): Promise<{ codeEssai?: string }> {
  const email = normaliser(emailBrut);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {};

  let clientId: string | null = null;
  let utilisateurId: string | null = null;
  if (espace === "CLIENT") {
    // Seuls les clients ayant au moins un dossier payé ont un espace.
    const [c] = await d
      .select({ id: clients.id })
      .from(clients)
      .innerJoin(dossiers, eq(dossiers.clientId, clients.id))
      .where(and(sql`lower(${clients.email}) = ${email}`, sql`${dossiers.statut} not in ('PRE_DOSSIER')`))
      .limit(1);
    if (!c) return {};
    clientId = c.id;
  } else {
    const [u] = await d.select({ id: utilisateurs.id, actif: utilisateurs.actif }).from(utilisateurs).where(eq(utilisateurs.email, email));
    if (!u || !u.actif) return {};
    utilisateurId = u.id;
  }

  // Limite : 5 codes par adresse et par heure.
  const [{ n }] = await d
    .select({ n: sql<number>`count(*)` })
    .from(codesConnexion)
    .where(and(eq(codesConnexion.email, email), gt(codesConnexion.expireLe, new Date(Date.now() - 50 * 60_000))));
  if (Number(n) >= 5) return {};

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await d.insert(codesConnexion).values({
    espace,
    email,
    clientId,
    utilisateurId,
    empreinte: hacher(code),
    canal: "EMAIL",
    expireLe: new Date(Date.now() + VALIDITE_MIN * 60_000),
  });
  await envoyer({
    canal: "EMAIL",
    destinataire: email,
    sujet: "Votre code de connexion LEXPATRIA",
    texte: `Votre code de connexion : ${code}\nIl est valable ${VALIDITE_MIN} minutes. Si vous n'avez rien demandé, ignorez ce message.\n\nLEXPATRIA Avocats`,
  });
  return process.env.NODE_ENV === "production" ? {} : { codeEssai: code };
}

/** Vérifie le code. Retourne le sujet de la session (e-mail du client ou id de l'utilisateur), ou null. */
export async function verifierCode(d: Base, espace: Espace, emailBrut: string, code: string): Promise<string | null> {
  const email = normaliser(emailBrut);
  const [c] = await d
    .select()
    .from(codesConnexion)
    .where(
      and(
        eq(codesConnexion.espace, espace),
        eq(codesConnexion.email, email),
        isNull(codesConnexion.utiliseLe),
        gt(codesConnexion.expireLe, new Date()),
      ),
    )
    .orderBy(desc(codesConnexion.expireLe))
    .limit(1);
  if (!c || c.essais >= ESSAIS_MAX) return null;
  if (c.empreinte !== hacher(code.replace(/\D/g, ""))) {
    await d.update(codesConnexion).set({ essais: c.essais + 1 }).where(eq(codesConnexion.id, c.id));
    return null;
  }
  await d.update(codesConnexion).set({ utiliseLe: new Date() }).where(eq(codesConnexion.id, c.id));
  await journaliser(d, { acteur: espace === "CLIENT" ? "CLIENT" : c.utilisateurId!, action: espace === "CLIENT" ? "CONNEXION_CLIENT" : "CONNEXION_EQUIPE" });
  return espace === "CLIENT" ? email : c.utilisateurId;
}
