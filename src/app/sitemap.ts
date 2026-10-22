import type { MetadataRoute } from "next";
import { SITUATIONS } from "@/lib/situations";

const base = process.env.URL_PUBLIQUE ?? "https://lexpatria.fr";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: base }, ...SITUATIONS.map((s) => ({ url: `${base}/${s.slug}` }))];
}
