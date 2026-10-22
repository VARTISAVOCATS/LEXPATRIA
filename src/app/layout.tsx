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
import { FournisseurContenus } from "./composants/Contenus";
import Consentement from "./Consentement";
import "./interface.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEXPATRIA Avocats — Déposer votre recours en ligne",
  description:
    "OQTF, refus de titre de séjour, refus de visa, naturalisation, préfecture sans réponse : déposez votre dossier en ligne, un avocat du cabinet le prend en charge sous 48 heures ouvrées.",
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
