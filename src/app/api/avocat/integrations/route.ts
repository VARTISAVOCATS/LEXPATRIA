// Espace cabinet : envoi recommandé (Maileva), numéro Télérecours, classement SharePoint à la demande.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { accesEquipe } from "@/lib/serveur/dossiers";
import { envoyerRecommande } from "@/lib/serveur/integrations/maileva";
import { classerDossier } from "@/lib/serveur/integrations/sharepoint";
import { enregistrerNumero } from "@/lib/serveur/integrations/telerecours";
import { graphConfigure } from "@/lib/serveur/integrations/graph";
import { valeur } from "@/lib/serveur/connexions";
import { membreConnecte } from "@/lib/serveur/session";

export const runtime = "nodejs";

const Corps = z.object({
  reference: z.string().max(20),
  action: z.enum(["recommande", "enregistrement", "sharepoint"]),
  adresse: z.string().max(600).optional(),
  numero: z.string().max(30).optional(),
  date: z.string().max(10).optional(),
});

export async function POST(req: Request) {
  const m = await membreConnecte();
  if (!m) return NextResponse.json({ erreur: "Session expirée." }, { status: 401 });
  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  const d = await db();
  const dos = await accesEquipe(d, m, c.data.reference);
  if (!dos) return NextResponse.json({ erreur: "Dossier introuvable." }, { status: 404 });
  const x = c.data;
  if (x.action === "recommande") {
    const r = await envoyerRecommande(d, m, dos, x.adresse ?? "");
    return r.ok ? NextResponse.json(r) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
  }
  if (x.action === "enregistrement") {
    const r = await enregistrerNumero(d, m, dos, x.numero ?? "", x.date ?? "");
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
  }
  if (!(await graphConfigure()) || !(await valeur("SHAREPOINT_SITE")))
    return NextResponse.json({ erreur: "SharePoint n'est pas configuré (back office › Connexions)." }, { status: 422 });
  try {
    const r = await classerDossier(d, dos, m.id);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ erreur: `SharePoint : ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}
