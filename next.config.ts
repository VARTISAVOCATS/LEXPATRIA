import type { NextConfig } from "next";

const entetesSecurite = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(self)" },
];

// Politique de sécurité des contenus, d'abord en mode observation (« Report-Only ») : rien n'est bloqué,
// les navigateurs signalent à /api/csp ce qui l'aurait été. Après une à deux semaines sans signalement anormal,
// passer CSP_APPLIQUEE à true pour l'appliquer (les en-têtes sont fixés à la compilation).
const CSP_APPLIQUEE = false;
const csp = (cadre: "'none'" | "'self'") =>
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com",
    "connect-src 'self' https://api.stripe.com https://m.stripe.network https://q.stripe.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://*.tiktok.com https://analytics.tiktok.com",
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://www.facebook.com",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${cadre}`,
    "report-uri /api/csp",
  ].join("; ");
const enteteCsp = CSP_APPLIQUEE ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";

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
      { source: "/((?!api/fichier).*)", headers: [...entetesSecurite, { key: enteteCsp, value: csp("'none'") }] },
      { source: "/api/fichier", headers: [...pieces, { key: enteteCsp, value: csp("'self'") }] },
    ];
  },
};

export default nextConfig;
