// Back office (réservé aux associés) : paramètres, retour arrière, équipe, assistant de modification.
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { journaliser } from "@/lib/journal";
import { CLES_PARAMETRES, type CleParametre } from "@/lib/parametres";
import { decider, proposer } from "@/lib/serveur/assistant";
import { ecrireParametre, restaurer } from "@/lib/serveur/parametres";
import { membreConnecte } from "@/lib/serveur/session";
import { createId } from "@/db/id";

const Corps = z.discriminatedUnion("action", [
  z.object({ action: z.literal("parametre"), cle: z.string(), valeur: z.unknown() }),
  z.object({ action: z.literal("restaurer"), id: z.string().max(40) }),
  z.object({ action: z.literal("proposer"), demande: z.string().min(3).max(3000) }),
  z.object({ action: z.literal("decider"), id: z.string().max(40), valider: z.boolean() }),
  z.object({
    action: z.literal("membre"),
    prenom: z.string().trim().min(1).max(60),
    nom: z.string().trim().min(1).max(60),
    email: z.string().trim().email().max(200),
    role: z.enum(["ASSOCIE", "AVOCAT", "SECRETARIAT"]),
  }),
  z.object({ action: z.literal("membreActif"), id: z.string().max(40), actif: z.boolean() }),
]);

export async function POST(req: Request) {
  const m = await membreConnecte();
  if (!m || m.role !== "ASSOCIE") return NextResponse.json({ erreur: "Réservé aux associés." }, { status: 403 });
  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  const d = await db();
  const x = c.data;

  if (x.action === "parametre") {
    if (!(CLES_PARAMETRES as string[]).includes(x.cle)) return NextResponse.json({ erreur: "Paramètre inconnu." }, { status: 400 });
    const r = await ecrireParametre(d, x.cle as CleParametre, x.valeur, m.id);
    return r.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ erreur: [...r.erreurs, ...r.infractions.map((i) => `Terme interdit « ${i.motif} » : …${i.extrait}…`)].join(" ; ") }, { status: 422 });
  }
  if (x.action === "restaurer") {
    const r = await restaurer(d, x.id, m.id);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erreur: r.erreurs.join(" ; ") || "Retour impossible." }, { status: 422 });
  }
  if (x.action === "proposer") {
    try {
      const p = await proposer(d, m.id, x.demande);
      return NextResponse.json({ ok: true, id: p.id });
    } catch {
      return NextResponse.json({ erreur: "L'assistant n'a pas pu préparer de proposition. Reformulez la demande." }, { status: 502 });
    }
  }
  if (x.action === "decider") {
    const r = await decider(d, m.id, x.id, x.valider);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
  }
  if (x.action === "membre") {
    await d
      .insert(schema.utilisateurs)
      .values({ id: createId(), prenom: x.prenom, nom: x.nom, email: x.email.toLowerCase(), role: x.role })
      .onConflictDoUpdate({ target: schema.utilisateurs.email, set: { prenom: x.prenom, nom: x.nom, role: x.role, actif: true } });
    await journaliser(d, { acteur: m.id, action: "MEMBRE_ENREGISTRE", details: { email: x.email.toLowerCase(), role: x.role } });
    return NextResponse.json({ ok: true });
  }
  if (x.id === m.id && !x.actif) return NextResponse.json({ erreur: "Vous ne pouvez pas désactiver votre propre compte." }, { status: 422 });
  await d.update(schema.utilisateurs).set({ actif: x.actif }).where(eq(schema.utilisateurs.id, x.id));
  await journaliser(d, { acteur: m.id, action: x.actif ? "MEMBRE_ACTIVE" : "MEMBRE_DESACTIVE", details: { id: x.id } });
  return NextResponse.json({ ok: true });
}
