// Confirmation des paiements par Stripe : seule source de vérité, jamais le navigateur.

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/db";
import { marquerPaye } from "@/lib/serveur/paiement";
import { echeancePayee } from "@/lib/serveur/echeancier";
import { valeur } from "@/lib/serveur/connexions";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const s = await stripe();
  const secret = await valeur("STRIPE_WEBHOOK_SECRET");
  if (!s || !secret) return NextResponse.json({ erreur: "Stripe non configuré" }, { status: 503 });

  let ev: Stripe.Event;
  try {
    ev = s.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ erreur: "Signature invalide" }, { status: 400 });
  }

  if (ev.type === "payment_intent.succeeded") {
    const pi = ev.data.object as Stripe.PaymentIntent;
    const dossierId = pi.metadata?.dossierId;
    // Échéance 2 ou 3 du paiement en trois fois (prélèvement automatique ou régularisation par le client).
    if (pi.metadata?.echeanceId) {
      const moyenId = typeof pi.payment_method === "string" ? pi.payment_method : (pi.payment_method?.id ?? null);
      await echeancePayee(await db(), pi.metadata.echeanceId, { intentId: pi.id, moyenId });
    } else if (dossierId) {
      const d = await db();
      await marquerPaye(d, dossierId, { intentId: pi.id, moyen: pi.payment_method_types?.join(",") });
    }
  }
  return NextResponse.json({ recu: true });
}
