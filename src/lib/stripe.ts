import Stripe from "stripe";
import { surChangement, valeur } from "@/lib/serveur/connexions";

let client: { cle: string; s: Stripe } | null = null;
surChangement(() => (client = null));

/** Client Stripe, ou null si la clé n'est pas configurée (back office ou .env). */
export async function stripe(): Promise<Stripe | null> {
  const cle = await valeur("STRIPE_SECRET_KEY");
  if (!cle) return null;
  if (!client || client.cle !== cle) client = { cle, s: new Stripe(cle) };
  return client.s;
}
