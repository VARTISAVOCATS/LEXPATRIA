// Réservation du créneau choisi (consultation payée).
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { verifier } from "@/lib/jeton";
import { reserver } from "@/lib/serveur/integrations/bookings";

export const runtime = "nodejs";

const Corps = z.object({ jeton: z.string().max(300), debut: z.string().max(40) });

export async function POST(req: Request) {
  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  const id = verifier(c.data.jeton, "rdv");
  if (!id) return NextResponse.json({ erreur: "Lien expiré." }, { status: 401 });
  const d = await db();
  const [dos] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, id));
  if (!dos) return NextResponse.json({ erreur: "Dossier introuvable." }, { status: 404 });
  try {
    const r = await reserver(d, dos, c.data.debut);
    return r.ok ? NextResponse.json(r) : NextResponse.json({ erreur: r.erreur }, { status: 409 });
  } catch {
    return NextResponse.json({ erreur: "La réservation n'a pas abouti. Réessayez ou choisissez un autre créneau." }, { status: 502 });
  }
}
