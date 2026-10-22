// Mesure anonyme de l'entonnoir (cahier des charges, 12 « Suivi des abandons ») : aucune donnée identifiante,
// pas de cookie ; un identifiant de session aléatoire propre à l'onglet.
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { verifier } from "@/lib/jeton";

export const runtime = "nodejs";

const Corps = z.object({
  session: z.string().max(40),
  etape: z.string().max(40),
  procedure: z.string().max(40).nullable().optional(),
  source: z.string().max(60).nullable().optional(),
  appareil: z.enum(["mobile", "ordinateur"]).optional(),
  langue: z.string().max(5).optional(),
  motif: z.enum(["TROP_CHER", "REFLECHIR", "PARLER"]).optional(),
  jeton: z.string().optional(), // pour mémoriser le point d'arrêt d'un pré-dossier
});

export async function POST(req: Request) {
  const p = Corps.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false }, { status: 400 });
  const d = await db();
  const { jeton, ...e } = p.data;
  await d.insert(schema.evenementsParcours).values({ ...e, procedure: e.procedure ?? null, source: e.source ?? null });
  const id = jeton ? verifier(jeton) : null;
  if (id) await d.update(schema.dossiers).set({ etapeAtteinte: e.etape }).where(eq(schema.dossiers.id, id));
  return NextResponse.json({ ok: true });
}
