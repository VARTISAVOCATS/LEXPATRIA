// Rapports de la politique de sécurité des contenus (CSP) envoyés par les navigateurs, en mode observation :
// chaque blocage qui aurait eu lieu est consigné dans les journaux du serveur (« CSP » : directive et ressource), sans donnée personnelle.
import { autoriser, ipDe } from "@/lib/serveur/limiteur";

export async function POST(req: Request) {
  if (!autoriser(`csp:${ipDe(req)}`, 30, 60_000)) return new Response(null, { status: 204 });
  const corps = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const r = ((corps?.["csp-report"] as Record<string, unknown>) ?? (Array.isArray(corps) ? (corps[0] as Record<string, unknown>)?.body : null) ?? {}) as Record<string, unknown>;
  const directive = String(r["effective-directive"] ?? r["violated-directive"] ?? r.effectiveDirective ?? "?").slice(0, 60);
  const bloque = String(r["blocked-uri"] ?? r.blockedURL ?? "?").replace(/[?#].*$/, "").slice(0, 160);
  const page = String(r["document-uri"] ?? r.documentURL ?? "?").replace(/[?#].*$/, "").slice(0, 120);
  console.warn(`CSP ${directive} ${bloque} (page ${page})`);
  return new Response(null, { status: 204 });
}
