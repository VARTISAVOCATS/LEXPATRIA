import type { MetadataRoute } from "next";
import { db } from "@/db";
import { publies } from "@/lib/serveur/blog";
import { BASE } from "@/lib/seo";
import { consultationOuverte } from "@/lib/serveur/integrations/bookings";
import { MISE_A_JOUR, SITUATIONS } from "@/lib/situations";

// Lu à chaque demande : un article publié apparaît aussitôt dans le plan du site.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await publies(await db()).catch(() => []);
  const maj = new Date(MISE_A_JOUR);
  return [
    { url: BASE, lastModified: maj, changeFrequency: "weekly", priority: 1 },
    ...SITUATIONS.map((s) => ({ url: `${BASE}/${s.slug}`, lastModified: maj, changeFrequency: "monthly" as const, priority: 0.9 })),
    { url: `${BASE}/honoraires`, lastModified: maj, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/cabinet`, lastModified: maj, changeFrequency: "monthly", priority: 0.6 },
    ...((await consultationOuverte()) ? [{ url: `${BASE}/consultation`, lastModified: maj, changeFrequency: "monthly" as const, priority: 0.6 }] : []),
    { url: `${BASE}/actualites`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/mentions-legales`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/confidentialite`, changeFrequency: "yearly", priority: 0.2 },
    ...articles.map((a) => ({ url: `${BASE}/actualites/${a.slug}`, lastModified: a.majLe, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
