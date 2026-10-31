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
import { envoyer } from "@/lib/serveur/notifications";

export const runtime = "nodejs";

const Corps = z.object({
  recit: z.string().max(8000).optional(),
  images: z
    .array(z.object({ mime: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string() }))
    .max(10)
    .optional(),
  pdfs: z.array(z.object({ base64: z.string() })).max(3).optional(),
  procedure: z.enum(["OQTF", "REFUS_TITRE", "REFUS_VISA", "NATURALISATION"]).optional(),
});

// Alerte au cabinet quand l'analyse par l'IA est indisponible : au plus une par heure, sans aucune donnée du client.
let derniereAlerte = 0;
async function alerterIndisponibilite(cause: string) {
  console.error("Orientation IA impossible :", cause);
  if (Date.now() - derniereAlerte < 3600_000) return;
  derniereAlerte = Date.now();
  const dest = (await valeur("EMAIL_EXPEDITEUR")) ?? "contact@lexpatria.fr";
  await envoyer({
    canal: "EMAIL",
    destinataire: dest,
    sujet: "LEXPATRIA : analyse par l'IA indisponible",
    texte:
      "L'analyse automatique des situations est indisponible sur lexpatria.fr. Les visiteurs choisissent eux-mêmes leur situation dans une liste et poursuivent leur dépôt.\n\n" +
      `Cause : ${cause}\n\nVérifiez Back office › Connexions › Anthropic (clé, crédit) puis cliquez sur « Tester ».`,
  }).catch(() => undefined);
}

// Réponse de secours : l'écran propose la liste des situations, le dépôt continue.
const SECOURS = { erreur: "", secours: true };

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

  // Sans clé Anthropic ou en cas d'échec de l'IA : en production, jamais d'orientation par mots-clés ;
  // le visiteur choisit sa situation dans une liste et poursuit son dépôt, le cabinet est alerté.
  const cleIA = await valeur("ANTHROPIC_API_KEY");
  const simulation = process.env.NODE_ENV !== "production" || !!process.env.AUTORISER_SIMULATION;
  if (!cleIA && !simulation) {
    await alerterIndisponibilite("aucune clé Anthropic enregistrée");
    return NextResponse.json(SECOURS, { status: 503 });
  }
  let t;
  try {
    t = cleIA
      ? await trier(corps.data, new Anthropic({ apiKey: cleIA }), (await valeur("ANTHROPIC_MODEL_TRIAGE")) ?? (await valeur("ANTHROPIC_MODEL")))
      : trierSimule(corps.data.recit ?? "");
  } catch (e) {
    // Cause consignée (jamais le récit du client).
    await alerterIndisponibilite(e instanceof Error ? e.message.slice(0, 500) : String(e));
    return NextResponse.json(SECOURS, { status: 503 });
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
