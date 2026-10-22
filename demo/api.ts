// Serveur simulé dans le navigateur : mêmes règles que la plateforme (délais, tarifs, convention),
// sans base de données ni paiement réel. Orientation par mots-clés (l'IA n'est pas appelée dans la démo).
import { jour, versJour } from "../src/lib/calendrier";
import { evaluerDelai } from "../src/lib/delais";
import { PROCEDURES, TARIFS_DEFAUT, type CodeProcedure } from "../src/lib/procedures";
import { trierSimule } from "../src/lib/triage";

const dossiers = new Map<string, Record<string, unknown>>();
let numero = 1000;
export const AVOCAT_DEMO = { prenom: "Boualem", nom: "Kachi" };

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { "content-type": "application/json" } });
const enDate = (s?: string | null) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return jour(y, m, d);
};
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function installerApiSimulee() {
  const fetchReel = window.fetch.bind(window);
  window.fetch = async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
    const u = new URL(url, "https://demo.lexpatria.fr");
    if (!u.pathname.startsWith("/api/")) return fetchReel(entree, init);
    const corps = typeof init?.body === "string" ? JSON.parse(init.body) : {};

    switch (u.pathname) {
      case "/api/triage": {
        await attendre(900);
        const t = trierSimule(corps.recit ?? "");
        if (!corps.recit && corps.images?.length) {
          // Photo seule : la démo fait comme si l'IA avait lu une OQTF reçue il y a cinq jours.
          Object.assign(t, { procedure: "OQTF", dateNotification: new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10) });
        }
        if (t.detentionOuRetention) return json({ triage: t, refus: /r[ée]tention|cra/i.test(corps.recit ?? "") ? "RETENTION" : "DETENTION" });
        const p = PROCEDURES[t.procedure as CodeProcedure];
        return json({ triage: t, procedure: { code: p.code, libelle: p.libelle }, prix: { principal: TARIFS_DEFAUT[p.diligence] } });
      }
      case "/api/predossier": {
        await attendre(300);
        const delai = evaluerDelai({
          procedure: corps.procedure,
          situationOQTF: corps.situationOQTF ?? undefined,
          dateReference: enDate(corps.dateReference),
          dateDemande: enDate(corps.dateDemande),
          dateEcheance: enDate(corps.dateEcheance),
          aujourdhui: versJour(new Date()),
        });
        const reference = `D${++numero}`;
        const jeton = `demo-${reference}`;
        dossiers.set(jeton, { ...corps, reference, traitement: delai.traitement });
        return json({ reference, jeton, traitement: delai.traitement });
      }
      case "/api/questionnaire":
      case "/api/pieces":
      case "/api/evenement":
        await attendre(150);
        return json({ ok: true, nombre: 1 });
      case "/api/paiement": {
        await attendre(700);
        const d = dossiers.get(corps.jeton ?? "") ?? dossiers.get(String(corps.jetonProche ?? "").replace("proche-", ""));
        if (d) d.paye = true;
        return json({ simulation: true, reference: d?.reference ?? "D1001" });
      }
      case "/api/proche": {
        await attendre(300);
        const d = dossiers.get(corps.jeton);
        return json({ lien: `https://lexpatria.fr/regler/proche-${corps.jeton}`, reference: d?.reference });
      }
      default:
        return json({ erreur: "Fonction indisponible dans la démo." }, 404);
    }
  };
}

export function dossierDemo(reference: string) {
  return [...dossiers.values()].find((d) => d.reference === reference);
}
