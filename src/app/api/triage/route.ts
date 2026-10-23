import { NextResponse } from "next/server";
import { z } from "zod";
import { jour, versJour } from "@/lib/calendrier";
import { evaluerDelai } from "@/lib/delais";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { valeur } from "@/lib/serveur/connexions";
import { PROCEDURES } from "@/lib/procedures";
import { lireParametre } from "@/lib/serveur/parametres";
import { trier, trierSimule } from "@/lib/triage";

export const runtime = "nodejs";

const Corps = z.object({
  recit: z.string().max(8000).optional(),
  images: z
    .array(z.object({ mime: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string() }))
    .max(10)
    .optional(),
  pdfs: z.array(z.object({ base64: z.string() })).max(3).optional(),
});

function parseDate(s: string | null): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return jour(y, m, d);
}

export async function POST(req: Request) {
  const corps = Corps.safeParse(await req.json().catch(() => null));
  if (!corps.success || (!corps.data.recit && !corps.data.images?.length && !corps.data.pdfs?.length)) {
    return NextResponse.json({ erreur: "Décrivez votre situation ou transmettez votre décision." }, { status: 400 });
  }

  const TARIFS = await lireParametre(await db(), "tarifs");

  // Sans clé Anthropic (développement) : orientation simulée par mots-clés.
  const cleIA = await valeur("ANTHROPIC_API_KEY");
  let t;
  try {
    t = cleIA
      ? await trier(corps.data, new Anthropic({ apiKey: cleIA }), (await valeur("ANTHROPIC_MODEL_TRIAGE")) ?? (await valeur("ANTHROPIC_MODEL")))
      : trierSimule(corps.data.recit ?? "");
  } catch (e) {
    // Cause consignée dans les journaux du serveur (jamais le récit du client) ; message sobre à l'écran.
    console.error("Orientation IA impossible :", e instanceof Error ? e.message.slice(0, 500) : e);
    return NextResponse.json({ erreur: "L'analyse est momentanément indisponible. Réessayez dans quelques instants." }, { status: 503 });
  }
  const aujourdhui = versJour(new Date());

  if (t.detentionOuRetention || t.situationOQTF === "DETENTION" || t.situationOQTF === "RETENTION") {
    return NextResponse.json({ triage: t, refus: t.situationOQTF === "RETENTION" ? "RETENTION" : "DETENTION" });
  }
  if (t.procedure === "HORS_PERIMETRE") {
    return NextResponse.json({ triage: t, refus: "HORS_PERIMETRE" });
  }

  // La situation OQTF n'est jamais choisie par défaut : si l'IA ne la connaît pas, l'écran la demande.
  const delai =
    t.procedure === "OQTF" && !t.situationOQTF
      ? null
      : evaluerDelai({
          procedure: t.procedure,
          situationOQTF: t.situationOQTF ?? undefined,
          dateReference: parseDate(t.dateNotification) ?? parseDate(t.dateDecision),
          dateDemande: parseDate(t.dateDemande),
          aujourdhui,
        });

  const proc = PROCEDURES[t.procedure];
  return NextResponse.json({
    triage: t,
    procedure: { code: proc.code, libelle: proc.libelle },
    delai,
    // Le prix n'est pas affiché à l'écran « Résultat » ; il est renvoyé pour l'écran « Votre recours ».
    prix: {
      principal: TARIFS[proc.diligence],
      majorationUrgence: delai?.traitement === "URGENCE" ? TARIFS.MAJORATION_URGENCE : 0,
    },
  });
}
