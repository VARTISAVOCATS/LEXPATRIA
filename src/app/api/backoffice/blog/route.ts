// Back office : blog « Actualités » (rédaction, brouillon par l'IA, publication). Réservé aux associés.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { enregistrer, publier, rediger, SaisieArticle, supprimer } from "@/lib/serveur/blog";
import { membreConnecte } from "@/lib/serveur/session";

export const runtime = "nodejs";
export const maxDuration = 120;

const Corps = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enregistrer"), article: SaisieArticle }),
  z.object({ action: z.literal("publier"), id: z.string().max(40), publie: z.boolean() }),
  z.object({ action: z.literal("supprimer"), id: z.string().max(40) }),
  z.object({ action: z.literal("rediger"), sujet: z.string().trim().min(5).max(300) }),
]);

export async function POST(req: Request) {
  const m = await membreConnecte();
  if (!m || m.role !== "ASSOCIE") return NextResponse.json({ erreur: "Réservé aux associés." }, { status: 403 });
  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Requête invalide : vérifiez le titre (5 caractères au moins)." }, { status: 400 });
  const d = await db();
  const x = c.data;
  if (x.action === "supprimer") return NextResponse.json({ ok: await supprimer(d, m.id, x.id) });
  const r =
    x.action === "enregistrer" ? await enregistrer(d, m.id, x.article) : x.action === "publier" ? await publier(d, m.id, x.id, x.publie) : await rediger(d, m.id, x.sujet);
  return r.ok ? NextResponse.json(r) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
}
