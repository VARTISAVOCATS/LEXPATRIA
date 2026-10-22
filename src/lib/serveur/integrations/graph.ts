// Microsoft Graph (Microsoft 365) : jeton d'application (client credentials), mis en cache jusqu'à expiration.
// Autorisations d'application à accorder dans Azure : Calendars.ReadWrite (agendas) et Sites.ReadWrite.All
// ou Sites.Selected (SharePoint), avec le consentement de l'administrateur.

import { valeur } from "../connexions";
import { appelJson, ErreurIntegration } from "./commun";

let cache: { jeton: string; expire: number; cle: string } | null = null;

export async function graphConfigure() {
  const [t, i, s] = await Promise.all(["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET"].map(valeur));
  return !!(t && i && s);
}

async function jeton(): Promise<string> {
  const [tenant, id, secret] = await Promise.all(["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET"].map(valeur));
  if (!tenant || !id || !secret) throw new ErreurIntegration("Microsoft 365 n'est pas configuré.");
  const cle = `${tenant}:${id}`;
  if (cache && cache.cle === cle && cache.expire > Date.now() + 60_000) return cache.jeton;
  const r = await appelJson<{ access_token: string; expires_in: number }>(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials", scope: "https://graph.microsoft.com/.default" }),
  });
  cache = { jeton: r.access_token, expire: Date.now() + r.expires_in * 1000, cle };
  return r.access_token;
}

export async function graph<T = unknown>(chemin: string, init: RequestInit & { brut?: boolean } = {}): Promise<T> {
  const url = chemin.startsWith("https://") ? chemin : `https://graph.microsoft.com/v1.0${chemin}`;
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${await jeton()}`);
  if (init.body && !init.brut && !headers.has("content-type")) headers.set("content-type", "application/json");
  return appelJson<T>(url, { ...init, headers }, 60_000);
}
