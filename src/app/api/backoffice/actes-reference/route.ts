// Back office : actes de référence (import Word/PDF/texte, enregistrement, retrait, suppression).
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { activerActeReference, ajouterActeReference, supprimerActeReference, texteFichier } from "@/lib/serveur/actes-reference";
import { membreConnecte } from "@/lib/serveur/session";

export const runtime = "nodejs";

const Corps = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ajouter"), code: z.string().max(40), titre: z.string().max(160), texte: z.string().max(200_000), fichier: z.string().max(200).nullable().optional() }),
  z.object({ action: z.literal("activer"), id: z.string().max(40), actif: z.boolean() }),
  z.object({ action: z.literal("supprimer"), id: z.string().max(40) }),
]);

export async function POST(req: Request) {
  const m = await membreConnecte();
  if (!m || m.role !== "ASSOCIE") return NextResponse.json({ erreur: "Réservé aux associés." }, { status: 403 });

  // Import : renvoie le texte extrait et masqué, sans rien enregistrer (l'associé relit d'abord).
  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const f = (await req.formData()).get("fichier");
    if (!(f instanceof File) || !/\.(docx|pdf|txt)$/i.test(f.name) || f.size > 15 * 1024 * 1024)
      return NextResponse.json({ erreur: "Choisissez un fichier Word (.docx), PDF ou texte de 15 Mo au plus." }, { status: 400 });
    try {
      const texte = await texteFichier(f.name, Buffer.from(await f.arrayBuffer()));
      if (texte.length < 300) return NextResponse.json({ erreur: "Aucun texte exploitable dans ce fichier (un PDF scanné doit d'abord être converti en texte)." }, { status: 422 });
      return NextResponse.json({ texte, fichier: f.name });
    } catch {
      return NextResponse.json({ erreur: "Ce fichier n'a pas pu être lu." }, { status: 422 });
    }
  }

  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  const d = await db();
  const x = c.data;
  const r =
    x.action === "ajouter"
      ? await ajouterActeReference(d, m, x)
      : x.action === "activer"
        ? await activerActeReference(d, m, x.id, x.actif)
        : await supprimerActeReference(d, m, x.id);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
}
