// Absences et ouverture à l'attribution automatique des dossiers.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { ajouterIndisponibilite, basculerAttribution, supprimerIndisponibilite } from "@/lib/serveur/cabinet";
import { membreConnecte } from "@/lib/serveur/session";

const Corps = z.object({
  action: z.enum(["ajouter", "supprimer", "attribution"]),
  avocatId: z.string().max(40).optional(),
  debut: z.string().max(10).optional(),
  fin: z.string().max(10).optional(),
  id: z.string().max(40).optional(),
  ouverte: z.boolean().optional(),
});

export async function POST(req: Request) {
  const m = await membreConnecte();
  if (!m) return NextResponse.json({ erreur: "Session expirée." }, { status: 401 });
  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  // Un avocat gère ses propres absences ; un associé, celles de toute l'équipe.
  const cible = m.role === "ASSOCIE" && c.data.avocatId ? c.data.avocatId : m.id;
  const d = await db();
  const r =
    c.data.action === "ajouter"
      ? await ajouterIndisponibilite(d, m.id, cible, c.data.debut ?? "", c.data.fin ?? "")
      : c.data.action === "supprimer"
        ? await supprimerIndisponibilite(d, m, c.data.id ?? "")
        : await basculerAttribution(d, m.id, cible, !!c.data.ouverte);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
}
