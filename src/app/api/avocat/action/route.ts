// Actions sur un dossier depuis l'espace cabinet.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import * as cab from "@/lib/serveur/cabinet";
import { accesEquipe } from "@/lib/serveur/dossiers";
import { membreConnecte } from "@/lib/serveur/session";

const Corps = z.object({
  reference: z.string().max(20),
  action: z.enum(["accepter", "statut", "dateLimite", "echeance", "echeanceFaite", "demanderPiece", "verifierPiece", "reattribuer"]),
  statut: z.string().max(30).optional(),
  date: z.string().max(10).optional(),
  type: z.string().max(40).optional(),
  id: z.string().max(40).optional(),
  libelle: z.string().max(200).optional(),
  avocatId: z.string().max(40).optional(),
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
  const r =
    x.action === "accepter"
      ? await cab.accepter(d, m, dos)
      : x.action === "statut"
        ? await cab.changerStatut(d, m, dos, x.statut ?? "")
        : x.action === "dateLimite"
          ? await cab.fixerDateLimite(d, m, dos, x.date ?? "")
          : x.action === "echeance"
            ? await cab.ajouterEcheance(d, m, dos, x.type ?? "", x.date ?? "")
            : x.action === "echeanceFaite"
              ? await cab.echeanceFaite(d, m, dos, x.id ?? "")
              : x.action === "demanderPiece"
                ? await cab.demanderPiece(d, m, dos, x.libelle ?? "")
                : x.action === "verifierPiece"
                  ? await cab.verifierPiece(d, m, dos, x.id ?? "")
                  : await cab.reattribuer(d, m, dos, x.avocatId ?? "");
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
}
