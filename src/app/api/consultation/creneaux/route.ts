// Créneaux libres pour la consultation en visio (après paiement).
import { NextResponse } from "next/server";
import { verifier } from "@/lib/jeton";
import { creneaux } from "@/lib/serveur/integrations/bookings";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const id = verifier(new URL(req.url).searchParams.get("jeton") ?? "", "rdv");
  if (!id) return NextResponse.json({ erreur: "Lien expiré." }, { status: 401 });
  try {
    return NextResponse.json({ creneaux: (await creneaux()).map(({ debut, fin }) => ({ debut, fin })) });
  } catch {
    return NextResponse.json({ erreur: "Les disponibilités ne peuvent pas être lues pour le moment. Réessayez dans quelques minutes." }, { status: 502 });
  }
}
