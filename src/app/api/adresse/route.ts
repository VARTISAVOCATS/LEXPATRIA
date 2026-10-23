// Aide à la saisie de l'adresse postale (France) : suggestions d'adresses et communes d'un code postal.
// Base Adresse Nationale, servie par la Géoplateforme de l'IGN (repli : ancienne API Adresse), communes par l'API Découpage administratif.
// Le serveur relaie la requête : le navigateur du client ne contacte aucun service tiers. Rien n'est conservé.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface Suggestion {
  label: string;
  adresse: string;
  codePostal: string;
  ville: string;
}

type Feature = { properties?: { label?: string; name?: string; postcode?: string; city?: string; type?: string } };

async function chercher(url: string): Promise<Feature[] | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3500), headers: { accept: "application/json" } });
    if (!r.ok) return null;
    const j = (await r.json()) as { features?: Feature[] };
    return j.features ?? [];
  } catch {
    return null;
  }
}

async function adresses(q: string): Promise<Suggestion[]> {
  const enc = encodeURIComponent(q);
  const features =
    (await chercher(`https://data.geopf.fr/geocodage/search?q=${enc}&index=address&limit=5&autocomplete=1`)) ??
    (await chercher(`https://api-adresse.data.gouv.fr/search/?q=${enc}&limit=5&autocomplete=1`)) ??
    [];
  return features
    .map((f) => f.properties ?? {})
    .filter((p) => p.postcode && p.city && p.name && p.type !== "municipality")
    .map((p) => ({ label: p.label ?? `${p.name}, ${p.postcode} ${p.city}`, adresse: p.name!, codePostal: p.postcode!, ville: p.city! }));
}

async function communes(cp: string): Promise<string[]> {
  try {
    const r = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom&format=json`, { signal: AbortSignal.timeout(3500) });
    if (r.ok) {
      const j = (await r.json()) as { nom: string }[];
      if (j.length) return [...new Set(j.map((c) => c.nom))].sort((a, b) => a.localeCompare(b, "fr"));
    }
  } catch {
    /* repli ci-dessous */
  }
  const f = (await chercher(`https://data.geopf.fr/geocodage/search?q=${cp}&index=address&type=municipality&limit=20`)) ?? [];
  return [...new Set(f.map((x) => x.properties ?? {}).filter((p) => p.postcode === cp && p.city).map((p) => p.city!))].sort((a, b) => a.localeCompare(b, "fr"));
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const cp = (u.searchParams.get("cp") ?? "").trim();
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 200);
  const entete = { "cache-control": "private, max-age=300" };
  if (/^\d{5}$/.test(cp)) return NextResponse.json({ communes: await communes(cp) }, { headers: entete });
  if (q.length >= 4) return NextResponse.json({ suggestions: await adresses(q) }, { headers: entete });
  return NextResponse.json({ suggestions: [], communes: [] }, { headers: entete });
}
