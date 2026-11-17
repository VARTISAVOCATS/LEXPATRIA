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
    // Les fichiers de pièces s'affichent dans l'aperçu du poste de travail : cadre autorisé depuis le site lui-même uniquement.
    const pieces = entetesSecurite.map((h) => (h.key === "X-Frame-Options" ? { ...h, value: "SAMEORIGIN" } : h));
    return [
      { source: "/((?!api/fichier).*)", headers: entetesSecurite },
      { source: "/api/fichier", headers: pieces },
    ];
  },
};

export default nextConfig;
