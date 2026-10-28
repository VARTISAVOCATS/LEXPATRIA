import type { Metadata, Viewport } from "next";
// Polices auto-hébergées : aucun appel à Google Fonts (pas de transfert d'adresse IP des visiteurs).
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/spectral/500.css";
import "@fontsource/spectral/600.css";
import "@fontsource/spectral/700.css";
import { sens } from "@/i18n";
import { FournisseurLangue } from "@/i18n/client";
import { langueServeur } from "@/i18n/serveur";
import { db } from "@/db";
import { contenusPublics } from "@/lib/serveur/parametres";
import { BASE, NOM } from "@/lib/seo";
import { FournisseurContenus } from "./composants/Contenus";
import Consentement from "./Consentement";
import "./interface.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: "Recours OQTF, titre de séjour, visa — LEXPATRIA Avocats",
  description:
    "Avocats au barreau de Paris : recours contre une OQTF, un refus de titre de séjour, de visa ou de naturalisation. Prix indiqué avant tout paiement.",
  applicationName: NOM,
  openGraph: { siteName: NOM, locale: "fr_FR", type: "website" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

// Les contenus (tarifs, FAQ…) sont lus au back office à chaque requête (cache de 30 secondes).
export const dynamic = "force-dynamic";

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f1e3d" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const langue = await langueServeur();
  const contenus = await contenusPublics(await db());
  return (
    <html lang={langue} dir={sens(langue)}>
      <head>
        {/* L'interface distingue ordinateur et téléphone (libellés « Importer » / « Photographier »). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "var d=matchMedia('(pointer: fine)').matches;document.documentElement.classList.add(d?'is-desk':'is-mob')",
          }}
        />
      </head>
      <body>
        <FournisseurLangue langue={langue}>
          <FournisseurContenus valeur={contenus}>
            {children}
            <Consentement />
          </FournisseurContenus>
        </FournisseurLangue>
      </body>
    </html>
  );
}
