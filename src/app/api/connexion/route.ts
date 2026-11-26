// Connexion par code à usage unique (espaces client et cabinet).
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { demanderCode, verifierCode } from "@/lib/serveur/connexion";
import { ouvrirSession } from "@/lib/serveur/session";
import { autoriser, ipDe, tropDeDemandes } from "@/lib/serveur/limiteur";

const Corps = z.discriminatedUnion("etape", [
  z.object({ etape: z.literal("demande"), espace: z.enum(["CLIENT", "EQUIPE"]), email: z.string().max(200) }),
  z.object({ etape: z.literal("verification"), espace: z.enum(["CLIENT", "EQUIPE"]), email: z.string().max(200), code: z.string().max(12) }),
]);

export async function POST(req: Request) {
  if (!autoriser(`connexion:${ipDe(req)}`, 30, 15 * 60_000)) return tropDeDemandes();
  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  const d = await db();
  if (c.data.etape === "demande") {
    const r = await demanderCode(d, c.data.espace, c.data.email);
    return NextResponse.json({ ok: true, ...r });
  }
  const sujet = await verifierCode(d, c.data.espace, c.data.email, c.data.code);
  if (!sujet) return NextResponse.json({ erreur: "Code incorrect ou expiré." }, { status: 401 });
  await ouvrirSession(c.data.espace, sujet);
  return NextResponse.json({ ok: true });
}
