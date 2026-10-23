import type { MetadataRoute } from "next";
import { db } from "@/db";
import { publies } from "@/lib/serveur/blog";
import { SITUATIONS } from "@/lib/situations";

// Lu à chaque demande : un article publié apparaît aussitôt dans le plan du site.
export const dynamic = "force-dynamic";

const base = process.env.URL_PUBLIQUE ?? "https://lexpatria.fr";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await publies(await db()).catch(() => []);
  return [
    { url: base },
    { url: `${base}/consultation` },
    { url: `${base}/actualites` },
    ...SITUATIONS.map((s) => ({ url: `${base}/${s.slug}` })),
    ...articles.map((a) => ({ url: `${base}/actualites/${a.slug}`, lastModified: a.majLe })),
  ];
}
