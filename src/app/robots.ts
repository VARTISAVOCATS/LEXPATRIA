import type { MetadataRoute } from "next";
import { BASE } from "@/lib/seo";

// Pages privées exclues : dépôt, espaces, règlements, rendez-vous, désinscription, API.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/depot", "/espace", "/avocat", "/regler", "/echeance", "/desinscription", "/consultation/rendez-vous", "/api"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
