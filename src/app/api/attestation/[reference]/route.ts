// Attestation de prise en charge en PDF : pour le client (son espace) et pour le cabinet (poste de travail).
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { accesClient, voitTout } from "@/lib/serveur/dossiers";
import { attestationPdf } from "@/lib/serveur/pdf";
import { attestationsClient } from "@/lib/attestations";
import { clientConnecte, membreConnecte } from "@/lib/serveur/session";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const d = await db();
  let dos = null;
  const email = await clientConnecte();
  if (email) dos = await accesClient(d, email, reference);
  if (!dos) {
    const m = await membreConnecte();
    if (m) {
      const [x] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.reference, reference));
      if (x && (voitTout(m) || x.avocatId === m.id)) dos = x;
    }
  }
  if (!dos) return new Response("Dossier introuvable", { status: 404 });
  const liste = attestationsClient(dos.priseEnCharge);
  const n = Number(new URL(req.url).searchParams.get("n") ?? liste.length - 1);
  const a = liste[Number.isInteger(n) && n >= 0 ? n : liste.length - 1];
  if (!a) return new Response("Attestation pas encore signée", { status: 404 });
  const pdf = await attestationPdf({ texte: a.texte, le: new Date(a.le), reference: dos.reference, empreinte: a.empreinte ?? "", sousTitre: a.type === "DEPOT" ? "Prise en charge et dépôt du recours" : "Prise en charge du dossier" });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="Attestation-${dos.reference}${n > 0 ? `-${n + 1}` : ""}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
