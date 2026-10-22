import { NextResponse } from "next/server";
import { fermerSession } from "@/lib/serveur/session";

export async function POST(req: Request) {
  const espace = new URL(req.url).searchParams.get("espace") === "EQUIPE" ? "EQUIPE" : "CLIENT";
  await fermerSession(espace);
  return NextResponse.redirect(new URL(espace === "EQUIPE" ? "/avocat" : "/espace", req.url), 303);
}
