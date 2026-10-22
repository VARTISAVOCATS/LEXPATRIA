// Enregistrement progressif du questionnaire (chaque écran est sauvegardé : rien n'est perdu si le prospect s'interrompt).

import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { verifier } from "@/lib/jeton";

export const runtime = "nodejs";

const Corps = z.object({
  jeton: z.string(),
  reponses: z.record(z.string().max(40), z.string().max(4000).optional()),
  faitsConfirmes: z.array(z.object({ fait: z.string().max(500), exact: z.boolean(), correction: z.string().max(1000).optional() })).optional(),
});

export async function POST(req: Request) {
  const p = Corps.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ erreur: "Réponse invalide." }, { status: 400 });
  const id = verifier(p.data.jeton);
  if (!id) return NextResponse.json({ erreur: "Session expirée." }, { status: 401 });

  const d = await db();
  const [dos] = await d.select({ statut: schema.dossiers.statut }).from(schema.dossiers).where(eq(schema.dossiers.id, id));
  if (!dos || dos.statut !== "PRE_DOSSIER") return NextResponse.json({ erreur: "Dossier introuvable." }, { status: 404 });

  await d
    .update(schema.dossiers)
    .set({
      qualification: sql`jsonb_set(coalesce(${schema.dossiers.qualification}, '{}'::jsonb), '{reponses}', coalesce(${schema.dossiers.qualification}->'reponses', '{}'::jsonb) || ${JSON.stringify(p.data.reponses)}::jsonb)`,
      ...(p.data.faitsConfirmes ? { faitsExtraits: p.data.faitsConfirmes } : {}),
      majLe: new Date(),
    })
    .where(eq(schema.dossiers.id, id));
  return NextResponse.json({ ok: true });
}
