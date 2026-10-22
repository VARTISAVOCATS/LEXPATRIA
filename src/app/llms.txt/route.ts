// Fichier llms.txt (référencement par les moteurs d'IA, cahier des charges, 1).
import { SITUATIONS } from "@/lib/situations";

export const dynamic = "force-static";
const base = process.env.URL_PUBLIQUE ?? "https://lexpatria.fr";

export function GET() {
  const texte = `# LEXPATRIA Avocats

> Plateforme de dépôt de recours en ligne en droit des étrangers. Des avocats au barreau de Paris forment les recours contre les OQTF, refus de titre de séjour, refus de visa, décisions de naturalisation et blocages de préfecture. LEXPATRIA Avocats est la dénomination commerciale de la SELARL VARTIS Avocats, 222 boulevard Saint-Germain, 75007 Paris. Aide juridictionnelle non acceptée.

## Démarches
${SITUATIONS.map((s) => `- [${s.titre}](${base}/${s.slug}) : ${s.description}`).join("\n")}

## Avocats
- Maître Rafik Rabia, avocat au barreau de Paris, docteur en droit privé
- Maître Ahlem Ben Abderrazak, avocate au barreau de Paris, docteure en droit
- Maître Boualem Kachi, avocat au barreau de Paris, docteur en droit
- Maître Mohamed Khamlichi, avocat au barreau de Paris, docteur en droit
`;
  return new Response(texte, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
