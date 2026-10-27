// Tâche planifiée (cron OVH toutes les 15 minutes) : relances et purge des pré-dossiers,
// prélèvement des échéances du paiement en trois fois, rappels des échéances aux avocats (la veille et le jour), synchronisations Outlook, SharePoint, Pennylane, Maileva.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { rappelerEcheances } from "@/lib/serveur/agenda";
import { suivreEnvois } from "@/lib/serveur/integrations/maileva";
import { synchroniserOutlook } from "@/lib/serveur/integrations/outlook";
import { synchroniserPennylane } from "@/lib/serveur/integrations/pennylane";
import { synchroniserSharepoint } from "@/lib/serveur/integrations/sharepoint";
import { relancer } from "@/lib/serveur/relances";
import { preleverEcheances } from "@/lib/serveur/echeancier";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!process.env.SECRET_TACHES || req.headers.get("authorization") !== `Bearer ${process.env.SECRET_TACHES}`)
    return NextResponse.json({ erreur: "Non autorisé" }, { status: 401 });
  const d = await db();
  const resultat = { ...(await relancer(d)), ...(await rappelerEcheances(d)) };
  // Paiement en trois fois : prélèvements à échéance, nouvelles tentatives, pénalités.
  Object.assign(resultat, await preleverEcheances(d).catch((e: unknown) => ({ echeancier: String(e) })));
  // Intégrations du lot 5 : chacune est ignorée tant qu'elle n'est pas configurée, et une erreur n'arrête pas les autres.
  for (const f of [synchroniserOutlook, synchroniserSharepoint, synchroniserPennylane, suivreEnvois])
    Object.assign(resultat, await f(d).catch((e: unknown) => ({ [f.name]: String(e) })));
  return NextResponse.json(resultat);
}
