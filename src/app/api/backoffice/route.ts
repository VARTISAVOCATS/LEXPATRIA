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
import { CODES_QUALITE, QUALITES, VALEURS_CABINET, type Qualite } from "@/lib/equipe";

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
  z.object({
    action: z.literal("fiche"),
    id: z.string().max(40).optional(),
    prenom: z.string().trim().min(1).max(60),
    nom: z.string().trim().min(1).max(60),
    email: z.string().trim().email().max(200),
    qualite: z.enum(CODES_QUALITE as [Qualite, ...Qualite[]]),
    titre: z.string().trim().max(120).default(""),
    barreau: z.string().trim().max(60).default("Paris"),
    mobile: z.string().trim().max(30).default(""),
    photoUrl: z.string().trim().max(300).default(""),
    remuneration: z.enum(["AUCUNE", "COLLABORATEUR_FIXE_VARIABLE", "A_L_ACTE"]),
    // Montants saisis en euros HT, taux en pourcentage ; vides : valeurs du cabinet.
    fixeMensuel: z.number().min(0).max(100_000).nullable().default(null),
    seuilVariable: z.number().min(0).max(1_000_000).nullable().default(null),
    tauxVariable: z.number().min(0).max(100).nullable().default(null),
    acte: z.number().min(0).max(10_000).nullable().default(null),
    avis: z.number().min(0).max(10_000).nullable().default(null),
    validationAssocie: z.boolean().default(false),
    attributionOuverte: z.boolean().default(true),
  }),
  z.object({ action: z.literal("remunerationMembre"), id: z.string().max(40), mode: z.enum(["A_L_ACTE", "COLLABORATEUR_FIXE_VARIABLE", "AUCUNE"]) }),
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
  if (x.action === "fiche") {
    if (x.id === m.id && x.qualite !== "ASSOCIE") return NextResponse.json({ erreur: "Vous ne pouvez pas retirer votre propre qualité d'associé." }, { status: 422 });
    const cents = (v: number | null) => (v == null ? null : Math.round(v * 100));
    const email = x.email.toLowerCase();
    const autre = (await d.select({ id: schema.utilisateurs.id }).from(schema.utilisateurs).where(eq(schema.utilisateurs.email, email)))[0];
    if (autre && autre.id !== x.id) return NextResponse.json({ erreur: "Cette adresse e-mail est déjà celle d'un autre membre." }, { status: 422 });
    const fixe = x.remuneration === "COLLABORATEUR_FIXE_VARIABLE";
    const champs = {
      prenom: x.prenom,
      nom: x.nom,
      email,
      qualite: x.qualite,
      role: QUALITES[x.qualite].role,
      titre: x.titre || null,
      barreau: x.barreau || "Paris",
      mobile: x.mobile || null,
      photoUrl: x.photoUrl || null,
      remuneration: x.remuneration,
      fixeMensuelHT: fixe ? (cents(x.fixeMensuel) ?? VALEURS_CABINET.fixeMensuelHT) : null,
      seuilVariableHT: fixe ? (cents(x.seuilVariable) ?? VALEURS_CABINET.seuilVariableHT) : null,
      tauxVariable: fixe ? (x.tauxVariable == null ? VALEURS_CABINET.tauxVariable : x.tauxVariable / 100) : null,
      acteHT: x.remuneration === "A_L_ACTE" ? cents(x.acte) : null,
      avisHT: x.remuneration === "A_L_ACTE" ? cents(x.avis) : null,
      validationAssocie: x.validationAssocie,
      attributionOuverte: x.attributionOuverte,
    };
    if (x.id) {
      const maj = await d.update(schema.utilisateurs).set(champs).where(eq(schema.utilisateurs.id, x.id)).returning({ id: schema.utilisateurs.id });
      if (!maj.length) return NextResponse.json({ erreur: "Membre introuvable." }, { status: 404 });
    } else {
      await d.insert(schema.utilisateurs).values({ id: createId(), ...champs });
    }
    await journaliser(d, { acteur: m.id, action: x.id ? "MEMBRE_MODIFIE" : "MEMBRE_ENREGISTRE", details: { email, qualite: x.qualite, remuneration: x.remuneration } });
    return NextResponse.json({ ok: true });
  }
  if (x.action === "remunerationMembre") {
    // Fixe et variable : valeurs du cabinet par défaut (4 500 € HT par mois, 20 % au-delà de 13 500 € HT), si rien n'est encore enregistré.
    const [u] = await d.select().from(schema.utilisateurs).where(eq(schema.utilisateurs.id, x.id));
    if (!u) return NextResponse.json({ erreur: "Membre introuvable." }, { status: 404 });
    await d
      .update(schema.utilisateurs)
      .set({
        remuneration: x.mode,
        ...(x.mode === "COLLABORATEUR_FIXE_VARIABLE"
          ? { fixeMensuelHT: u.fixeMensuelHT ?? 450_000, seuilVariableHT: u.seuilVariableHT ?? 1_350_000, tauxVariable: u.tauxVariable ?? 0.2 }
          : {}),
      })
      .where(eq(schema.utilisateurs.id, x.id));
    await journaliser(d, { acteur: m.id, action: "REMUNERATION_MODIFIEE", details: { id: x.id, de: u.remuneration, vers: x.mode } });
    return NextResponse.json({ ok: true });
  }
  if (x.id === m.id && !x.actif) return NextResponse.json({ erreur: "Vous ne pouvez pas désactiver votre propre compte." }, { status: 422 });
  await d.update(schema.utilisateurs).set({ actif: x.actif }).where(eq(schema.utilisateurs.id, x.id));
  await journaliser(d, { acteur: m.id, action: x.actif ? "MEMBRE_ACTIVE" : "MEMBRE_DESACTIVE", details: { id: x.id } });
  return NextResponse.json({ ok: true });
}
