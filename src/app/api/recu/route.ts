// Reçu Stripe d'un paiement : accessible au client propriétaire du dossier et à l'équipe habilitée.
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { voitTout } from "@/lib/serveur/dossiers";
import { clientConnecte, membreConnecte } from "@/lib/serveur/session";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("paiement") ?? "";
  const d = await db();
  const [p] = await d.select().from(schema.paiements).where(eq(schema.paiements.id, id));
  if (!p || !p.stripeIntentId) return new Response("Reçu introuvable", { status: 404 });
  const [dos] = await d.select().from(schema.dossiers).where(eq(schema.dossiers.id, p.dossierId));
  let autorise = false;
  const m = await membreConnecte();
  if (m && (voitTout(m) || dos.avocatId === m.id)) autorise = true;
  if (!autorise) {
    const email = await clientConnecte();
    if (email) {
      const [c] = await d.select().from(schema.clients).where(sql`${schema.clients.id} = ${dos.clientId} and lower(${schema.clients.email}) = ${email}`);
      autorise = !!c;
    }
  }
  if (!autorise) return new Response("Accès refusé", { status: 403 });
  const s = await stripe();
  if (!s) return new Response("Reçu indisponible", { status: 404 });
  const pi = await s.paymentIntents.retrieve(p.stripeIntentId, { expand: ["latest_charge"] }).catch(() => null);
  const charge = pi?.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  if (!charge?.receipt_url) return new Response("Reçu indisponible", { status: 404 });
  return NextResponse.redirect(charge.receipt_url);
}
