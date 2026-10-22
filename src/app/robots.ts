import type { MetadataRoute } from "next";

const base = process.env.URL_PUBLIQUE ?? "https://lexpatria.fr";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/depot", "/espace", "/avocat", "/regler", "/api"] }], sitemap: `${base}/sitemap.xml` };
}
