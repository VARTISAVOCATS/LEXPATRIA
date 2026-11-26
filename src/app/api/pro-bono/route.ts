// Acceptation par le client de la convention d'intervention sans honoraires (lien reçu par e-mail).
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { accepterProBono } from "@/lib/serveur/probono";

const Corps = z.object({ jeton: z.string().max(300), executionImmediate: z.boolean() });

export async function POST(req: Request) {
  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "inconnue";
  const r = await accepterProBono(await db(), c.data.jeton, ip, c.data.executionImmediate);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
}
