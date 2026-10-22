// Connexions aux API externes : saisie au back office, chiffrement, lecture par le code, essai de connexion.
// - Chiffrement AES-256-GCM avec la clé CLE_CHIFFREMENT du serveur (jamais en base) ;
// - une valeur saisie au back office prime sur le fichier .env ; une valeur effacée rend la main au .env ;
// - les secrets ne sont jamais renvoyés au navigateur : seul un aperçu (4 derniers caractères) est conservé.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, type Base } from "@/db";
import { connexions } from "@/db/schema";
import { CHAMPS_CONNUS, connecteur, CONNECTEURS } from "@/lib/connecteurs";
import { journaliser } from "@/lib/journal";

export const EFFACER = "__effacer__";

function cleChiffrement(): Buffer | null {
  const k = process.env.CLE_CHIFFREMENT;
  if (k && /^[0-9a-f]{64}$/i.test(k)) return Buffer.from(k, "hex");
  if (process.env.NODE_ENV === "production") return null; // en production, la clé est obligatoire
  return createHash("sha256").update(`developpement:${process.env.SECRET_JETONS ?? ""}`).digest();
}

export function chiffrementDisponible() {
  return cleChiffrement() !== null;
}

function chiffrer(valeurs: Record<string, string>): string {
  const cle = cleChiffrement();
  if (!cle) throw new Error("CLE_CHIFFREMENT manquante");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cle, iv);
  const donnees = Buffer.concat([c.update(JSON.stringify(valeurs), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), donnees].map((b) => b.toString("base64url")).join(".");
}

function dechiffrer(texte: string): Record<string, string> {
  const cle = cleChiffrement();
  if (!cle) return {};
  try {
    const [iv, tag, donnees] = texte.split(".").map((s) => Buffer.from(s, "base64url"));
    const d = createDecipheriv("aes-256-gcm", cle, iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(donnees), d.final()]).toString("utf8"));
  } catch {
    return {}; // clé changée ou donnée altérée : on retombe sur le .env
  }
}

// Cache de 30 secondes des valeurs déchiffrées.
let cache: { le: number; valeurs: Record<string, string> } | null = null;
const auditeurs = new Set<() => void>();
/** Les clients d'API (Stripe…) se réinitialisent quand une connexion change. */
export function surChangement(f: () => void) {
  auditeurs.add(f);
}
export function viderCacheConnexions() {
  cache = null;
  auditeurs.forEach((f) => f());
}

async function valeursBase(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.le < 30_000) return cache.valeurs;
  const valeurs: Record<string, string> = {};
  try {
    const d = await db();
    for (const l of await d.select().from(connexions)) Object.assign(valeurs, dechiffrer(l.chiffre));
  } catch {
    // base indisponible : configuration du .env seule
  }
  cache = { le: Date.now(), valeurs };
  return valeurs;
}

/** Valeur d'une variable de configuration : back office d'abord, puis fichier .env. */
export async function valeur(nom: string): Promise<string | undefined> {
  const v = (await valeursBase())[nom];
  return v || process.env[nom] || undefined;
}

/** Configuration publique transmise au navigateur (aucun secret). */
export async function configPublique() {
  const [stripePublique, matomoUrl, matomoSite, metaPixel, tiktokPixel, googleAds, telephoneCabinet] = await Promise.all([
    valeur("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
    valeur("NEXT_PUBLIC_MATOMO_URL"),
    valeur("NEXT_PUBLIC_MATOMO_SITE_ID"),
    valeur("NEXT_PUBLIC_META_PIXEL_ID"),
    valeur("NEXT_PUBLIC_TIKTOK_PIXEL_ID"),
    valeur("NEXT_PUBLIC_GOOGLE_ADS_ID"),
    valeur("NEXT_PUBLIC_TELEPHONE_CABINET"),
  ]);
  return { stripePublique, matomoUrl, matomoSite, metaPixel, tiktokPixel, googleAds, telephoneCabinet };
}

const apercu = (v: string, secret: boolean) => (secret ? `••••${v.slice(-4)}` : v.length > 60 ? v.slice(0, 57) + "…" : v);

/** État de chaque connexion pour l'écran du back office (sans aucun secret). */
export async function etatConnexions(d: Base) {
  const lignes = new Map((await d.select().from(connexions)).map((l) => [l.service, l]));
  return CONNECTEURS.map((c) => {
    const l = lignes.get(c.id);
    const stockes = l ? dechiffrer(l.chiffre) : {};
    const champs = c.champs.map((ch) => {
      const enBase = stockes[ch.nom];
      const enEnv = process.env[ch.nom];
      const v = enBase || enEnv;
      return {
        ...ch,
        source: enBase ? ("back office" as const) : enEnv ? ("fichier .env" as const) : null,
        apercu: v ? apercu(v, ch.secret) : null,
      };
    });
    const requis = champs.filter((x) => x.requis);
    // Sans champ obligatoire (pixels, autre API) : « configuré » dès qu'une valeur est renseignée.
    const complet = requis.length ? requis.every((x) => x.source) : champs.some((x) => x.source);
    const facultatif = requis.length === 0;
    return { ...c, champs, complet, facultatif, majLe: l?.majLe ?? null, testLe: l?.testLe ?? null, testOk: l?.testOk ?? null, testMessage: l?.testMessage ?? null };
  });
}

/** Enregistre les champs saisis : vide = inchangé ; EFFACER = retire la valeur du back office. */
export async function enregistrerConnexion(d: Base, service: string, saisie: Record<string, string>, par: string): Promise<{ ok: boolean; erreur?: string }> {
  const c = connecteur(service);
  if (!c) return { ok: false, erreur: "Service inconnu." };
  if (!chiffrementDisponible()) return { ok: false, erreur: "Le serveur n'a pas de clé de chiffrement (CLE_CHIFFREMENT) : impossible d'enregistrer une clé d'API." };
  const [l] = await d.select().from(connexions).where(eq(connexions.service, service));
  const valeurs = l ? dechiffrer(l.chiffre) : {};
  const modifies: string[] = [];
  for (const ch of c.champs) {
    const v = saisie[ch.nom];
    if (v === undefined || v === "") continue;
    if (!CHAMPS_CONNUS.has(ch.nom)) continue;
    if (v === EFFACER) delete valeurs[ch.nom];
    else valeurs[ch.nom] = v.trim().slice(0, 2000);
    modifies.push(ch.nom);
  }
  if (!modifies.length) return { ok: false, erreur: "Aucune valeur saisie." };
  const apercus = Object.fromEntries(Object.entries(valeurs).map(([k, v]) => [k, apercu(v, c.champs.find((x) => x.nom === k)?.secret ?? true)]));
  const le = new Date();
  await d
    .insert(connexions)
    .values({ service, chiffre: chiffrer(valeurs), apercus, majPar: par, majLe: le })
    .onConflictDoUpdate({ target: connexions.service, set: { chiffre: chiffrer(valeurs), apercus, majPar: par, majLe: le, testLe: null, testOk: null, testMessage: null } });
  // Journal : quels champs ont changé, jamais leur valeur.
  await journaliser(d, { acteur: par, action: "CONNEXION_MODIFIEE", details: { service, champs: modifies } });
  viderCacheConnexions();
  return { ok: true };
}

async function appel(url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  return r;
}

/** Essai de connexion réel (lecture seule, aucune opération facturée). */
export async function testerConnexion(d: Base, service: string, par: string): Promise<{ ok: boolean; message: string }> {
  const v = (n: string) => valeur(n);
  let res: { ok: boolean; message: string };
  try {
    switch (service) {
      case "stripe": {
        const k = await v("STRIPE_SECRET_KEY");
        if (!k) throw new Error("Clé secrète absente.");
        const r = await appel("https://api.stripe.com/v1/balance", { headers: { authorization: `Bearer ${k}` } });
        const pk = await v("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
        const mode = k.includes("_live_") ? "production" : "test";
        res = r.ok
          ? { ok: true, message: `Clé secrète acceptée (mode ${mode}).${pk && pk.includes("_live_") !== k.includes("_live_") ? " Attention : clé publiable et clé secrète de modes différents." : ""}` }
          : { ok: false, message: `Stripe refuse la clé (code ${r.status}).` };
        break;
      }
      case "brevo": {
        const k = await v("BREVO_API_KEY");
        if (!k) throw new Error("Clé API absente.");
        const r = await appel("https://api.brevo.com/v3/account", { headers: { "api-key": k, accept: "application/json" } });
        res = r.ok ? { ok: true, message: "Clé acceptée par Brevo." } : { ok: false, message: `Brevo refuse la clé (code ${r.status}).` };
        break;
      }
      case "anthropic": {
        const k = await v("ANTHROPIC_API_KEY");
        if (!k) throw new Error("Clé API absente.");
        const r = await appel("https://api.anthropic.com/v1/models", { headers: { "x-api-key": k, "anthropic-version": "2023-06-01" } });
        res = r.ok ? { ok: true, message: "Clé acceptée par Anthropic." } : { ok: false, message: `Anthropic refuse la clé (code ${r.status}).` };
        break;
      }
      case "stockage": {
        const [endpoint, region, bucket, ak, sk] = await Promise.all(["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"].map(v));
        if (!endpoint || !bucket || !ak || !sk) throw new Error("Paramètres incomplets.");
        const { S3Client, HeadBucketCommand } = await import("@aws-sdk/client-s3");
        const client = new S3Client({ region: region ?? "gra", endpoint, credentials: { accessKeyId: ak, secretAccessKey: sk }, forcePathStyle: true });
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        res = { ok: true, message: `Conteneur « ${bucket} » accessible.` };
        break;
      }
      case "microsoft365": {
        const [tenant, id, secret] = await Promise.all(["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET"].map(v));
        if (!tenant || !id || !secret) throw new Error("Paramètres incomplets.");
        const r = await appel(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default" }),
        });
        res = r.ok ? { ok: true, message: "Application reconnue par Microsoft 365." } : { ok: false, message: `Microsoft refuse les identifiants (code ${r.status}).` };
        break;
      }
      case "autre": {
        const url = await v("AUTRE_API_URL");
        if (!url || !/^https:\/\//.test(url)) throw new Error("Adresse HTTPS absente.");
        const k = await v("AUTRE_API_CLE");
        const r = await appel(url, { headers: k ? { authorization: `Bearer ${k}` } : {} });
        res = r.status < 400 ? { ok: true, message: `Le service répond (code ${r.status}).` } : { ok: false, message: `Le service répond par une erreur (code ${r.status}).` };
        break;
      }
      default:
        res = { ok: false, message: "Pas d'essai automatique pour ce service : il sera vérifié lors de son intégration." };
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    const reseau = /fetch failed|aborted|timeout|ENOTFOUND|ECONNREFUSED|getaddrinfo/i.test(m) || (e instanceof Error && e.name === "TimeoutError");
    res = {
      ok: false,
      message: reseau
        ? "Le service ne répond pas : vérifiez l'adresse, ou l'accès du serveur à Internet."
        : m && m.length < 200 && /[éèàç]|absent|incomplet/i.test(m)
          ? m
          : "Connexion refusée : vérifiez les valeurs saisies.",
    };
  }
  await d.update(connexions).set({ testLe: new Date(), testOk: res.ok, testMessage: res.message }).where(eq(connexions.service, service));
  await journaliser(d, { acteur: par, action: "CONNEXION_TESTEE", details: { service, ok: res.ok } });
  return res;
}
