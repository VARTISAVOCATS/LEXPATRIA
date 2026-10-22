import type { NextConfig } from "next";

const entetesSecurite = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(self)" },
];

const nextConfig: NextConfig = {
  // Image autonome pour le serveur OVH (Docker) : seul le nécessaire est copié.
  output: "standalone",
  // Pilotes de base de données chargés tels quels côté serveur (pas d'empaquetage).
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:chemin*", headers: entetesSecurite }];
  },
};

export default nextConfig;
