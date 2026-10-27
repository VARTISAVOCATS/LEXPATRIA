// Régularisation d'une échéance rejetée, par le client, depuis le lien reçu par e-mail.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { verifier } from "@/lib/jeton";
import { ouvrirRegularisation } from "@/lib/serveur/echeancier";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const c = z.object({ jeton: z.string().max(400) }).safeParse(await req.json().catch(() => null));
  const id = c.success ? verifier(c.data.jeton, "echeance") : null;
  if (!id) return NextResponse.json({ erreur: "Lien expiré." }, { status: 401 });
  const r = await ouvrirRegularisation(await db(), id);
  if ("erreur" in r) return NextResponse.json({ erreur: r.erreur }, { status: 409 });
  return NextResponse.json({ ...r, reference: "" });
}
