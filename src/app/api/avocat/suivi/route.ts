// Questions des clients (réponse proposée, puis validée) et remise des avis écrits.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { compterManquants } from "@/lib/modeles";
import { proposerReponse, transmettreAvis } from "@/lib/serveur/agenda";
import { accesEquipe, ajouterMessage } from "@/lib/serveur/dossiers";
import { membreConnecte } from "@/lib/serveur/session";

const Corps = z.object({
  reference: z.string().max(20),
  action: z.enum(["proposer", "repondre", "transmettreAvis"]),
  contenu: z.string().max(5000).optional(),
});

export async function POST(req: Request) {
  const m = await membreConnecte();
  if (!m) return NextResponse.json({ erreur: "Session expirée." }, { status: 401 });
  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  const d = await db();
  const dos = await accesEquipe(d, m, c.data.reference);
  if (!dos) return NextResponse.json({ erreur: "Dossier introuvable." }, { status: 404 });
  try {
    if (c.data.action === "proposer") {
      const r = await proposerReponse(d, m, dos);
      return r.ok ? NextResponse.json(r) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
    }
    if (c.data.action === "repondre") {
      const texte = (c.data.contenu ?? "").trim();
      if (!texte) return NextResponse.json({ erreur: "Réponse vide." }, { status: 422 });
      if (compterManquants(texte) > 0) return NextResponse.json({ erreur: "Complétez les mentions XXX avant d'envoyer." }, { status: 422 });
      await ajouterMessage(d, dos, m.role === "SECRETARIAT" ? "SECRETARIAT" : "AVOCAT", m.id, texte);
      return NextResponse.json({ ok: true });
    }
    const r = await transmettreAvis(d, m, dos);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
  } catch {
    return NextResponse.json({ erreur: "Le service d'intelligence artificielle n'a pas répondu. Réessayez." }, { status: 502 });
  }
}
