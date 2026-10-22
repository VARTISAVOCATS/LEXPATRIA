// Poste de travail de l'avocat : analyse, projets, versions, attestation, transmission, assistant.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { LIBELLES_MODELE, type CodeModele } from "@/lib/modeles";
import { accesEquipe } from "@/lib/serveur/dossiers";
import { transmettreAvis } from "@/lib/serveur/agenda";
import * as poste from "@/lib/serveur/poste";
import { membreConnecte } from "@/lib/serveur/session";

const Corps = z.object({
  reference: z.string().max(20),
  action: z.enum(["analyser", "trancher", "generer", "enregistrer", "attester", "transmettre", "priseEnCharge", "question", "transmettreAvis"]),
  id: z.string().max(20).optional(),
  tranche: z.boolean().optional(),
  modele: z.string().max(40).optional(),
  contenu: z.string().max(200_000).optional(),
  secondes: z.number().min(0).max(86_400).optional(),
  question: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const m = await membreConnecte();
  if (!m) return NextResponse.json({ erreur: "Session expirée." }, { status: 401 });
  const c = Corps.safeParse(await req.json().catch(() => null));
  if (!c.success) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  const d = await db();
  const dos = await accesEquipe(d, m, c.data.reference);
  if (!dos) return NextResponse.json({ erreur: "Dossier introuvable." }, { status: 404 });
  const x = c.data;
  try {
    if (x.action === "question") {
      const r = await poste.questionAssistant(d, m, dos, x.question ?? "");
      return r.ok ? NextResponse.json(r) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
    }
    const r =
      x.action === "analyser"
        ? await poste.analyser(d, m, dos)
        : x.action === "trancher"
          ? await poste.trancher(d, m, dos, x.id ?? "", !!x.tranche)
          : x.action === "generer"
            ? x.modele && x.modele in LIBELLES_MODELE
              ? await poste.genererProjet(d, m, dos, x.modele as CodeModele)
              : ({ ok: false, erreur: "Modèle inconnu." } as const)
            : x.action === "enregistrer"
              ? await poste.enregistrerVersion(d, m, dos, x.contenu ?? "", x.secondes ?? 0)
              : x.action === "attester"
                ? await poste.attester(d, m, dos)
                : x.action === "transmettre"
                  ? await poste.transmettre(d, m, dos)
                  : x.action === "transmettreAvis"
                    ? await transmettreAvis(d, m, dos)
                    : await poste.signerPriseEnCharge(d, m, dos);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ erreur: r.erreur }, { status: 422 });
  } catch {
    return NextResponse.json({ erreur: "Le service d'intelligence artificielle n'a pas répondu. Réessayez." }, { status: 502 });
  }
}
