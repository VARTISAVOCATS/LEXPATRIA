// Attestation de prise en charge en PDF : pour le client (son espace) et pour le cabinet (poste de travail).
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { accesClient, voitTout } from "@/lib/serveur/dossiers";
import { attestationPdf } from "@/lib/serveur/pdf";
import { clientConnecte, membreConnecte } from "@/lib/serveur/session";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
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
  const pc = dos.priseEnCharge as { texte: string; le: string; empreinte?: string; depot?: { date: string | null; juridiction: string | null; numero: string | null } } | null;
  if (!pc) return new Response("Attestation pas encore signée", { status: 404 });
  const pdf = await attestationPdf({ texte: pc.texte, le: new Date(pc.le), reference: dos.reference, empreinte: pc.empreinte ?? "", depot: pc.depot ?? null });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="Attestation-${dos.reference}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
