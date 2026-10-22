// Back office : modèles d'actes du cabinet (enregistrement, retour arrière, import Word, aperçu).
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { DONNEES_EXEMPLE, genererModele, remplirModele, variablesInconnues } from "@/lib/modeles";
import { enregistrerModele, estCode, restaurerModele, texteDocx } from "@/lib/serveur/modeles-cabinet";
import { membreConnecte } from "@/lib/serveur/session";

export const runtime = "nodejs";

const Corps = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enregistrer"), code: z.string().max(40), texte: z.string().max(200_000), fichier: z.string().max(200).nullable().optional() }),
  z.object({ action: z.literal("restaurer"), id: z.string().max(40) }),
  z.object({ action: z.literal("apercu"), code: z.string().max(40), texte: z.string().max(200_000) }),
]);

export async function POST(req: Request) {
  const m = await membreConnecte();
  if (!m || m.role !== "ASSOCIE") return NextResponse.json({ erreur: "Réservé aux associés." }, { status: 403 });
  const d = await db();

  // Import d'un fichier Word : renvoie son texte, sans rien enregistrer (l'associé relit puis enregistre).
  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const f = (await req.formData()).get("fichier");
    if (!(f instanceof File) || !/\.docx$/i.test(f.name) || f.size > 10 * 1024 * 1024) return NextResponse.json({ erreur: "Choisissez un fichier Word (.docx) de 10 Mo au plus." }, { status: 400 });
    try {
      const texte = await texteDocx(Buffer.from(await f.arrayBuffer()));
      return NextResponse.json({ texte, fichier: f.name, inconnues: variablesInconnues(texte) });
    } catch {
      return NextResponse.json({ erreur: "Ce fichier Word n'a pas pu être lu." }, { status: 422 });
    }
  }

  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  const x = c.data;
  if (x.action === "apercu") {
    if (!estCode(x.code)) return NextResponse.json({ erreur: "Type d'acte inconnu." }, { status: 400 });
    const exemple = { ...DONNEES_EXEMPLE, procedure: x.code === "AVIS_ECRIT" ? "DIAGNOSTIC" : DONNEES_EXEMPLE.procedure };
    return NextResponse.json({ apercu: x.texte.trim() ? remplirModele(x.texte, exemple) : genererModele(x.code, exemple), inconnues: variablesInconnues(x.texte) });
  }
  const r = x.action === "enregistrer" ? await enregistrerModele(d, m, x.code, x.texte, x.fichier) : await restaurerModele(d, m, x.id);
  return r.ok ? NextResponse.json(r) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
}
