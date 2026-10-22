"use client";

// Bandeau de consentement (cahier des charges, 12) : sobre, « Accepter » et « Refuser » au même niveau,
// choix modifiable depuis le pied de page. Matomo, configuré sans cookie, mesure l'entonnoir sans consentement ;
// les pixels Meta, TikTok et Google (et le remarketing) ne se chargent qu'après acceptation.
// Le bandeau n'apparaît jamais pendant le parcours de dépôt.

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import type { ConfigPublique } from "@/lib/parametres";
import { useContenus } from "./composants/Contenus";

const COOKIE = "consentement";
type Choix = "accepte" | "refuse";

function lire(): Choix | null {
  try {
    const m = document.cookie.match(/(?:^|; )consentement=(accepte|refuse)/);
    return (m?.[1] as Choix) ?? null;
  } catch {
    return null;
  }
}

function chargerScript(src: string, init?: () => void) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  if (init) s.onload = init;
  document.head.appendChild(s);
}

function chargerPixels(c: ConfigPublique) {
  const meta = c.metaPixel;
  const tiktok = c.tiktokPixel;
  const google = c.googleAds;
  const w = window as unknown as Record<string, unknown> & { dataLayer?: unknown[] };
  if (google) {
    w.dataLayer = w.dataLayer ?? [];
    const gtag = (...a: unknown[]) => w.dataLayer!.push(a);
    w.gtag = gtag;
    chargerScript(`https://www.googletagmanager.com/gtag/js?id=${google}`, () => {
      gtag("js", new Date());
      gtag("config", google);
    });
  }
  if (meta) {
    chargerScript("https://connect.facebook.net/en_US/fbevents.js", () => {
      const fbq = w.fbq as ((...a: unknown[]) => void) | undefined;
      fbq?.("init", meta);
      fbq?.("track", "PageView");
    });
  }
  if (tiktok) chargerScript(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${tiktok}`);
}

function chargerMatomo(c: ConfigPublique) {
  const url = c.matomoUrl;
  const site = c.matomoSite;
  if (!url || !site) return;
  const w = window as unknown as { _paq?: unknown[][] };
  w._paq = w._paq ?? [];
  w._paq.push(["disableCookies"], ["setTrackerUrl", `${url}/matomo.php`], ["setSiteId", site], ["trackPageView"]);
  chargerScript(`${url}/matomo.js`);
}

export default function Consentement() {
  const t = useT();
  const chemin = usePathname();
  const [choix, setChoix] = useState<Choix | null | undefined>(undefined);
  const { config } = useContenus();

  useEffect(() => {
    const c = lire();
    setChoix(c);
    chargerMatomo(config);
    if (c === "accepte") chargerPixels(config);
    const rouvrir = () => setChoix(null);
    window.addEventListener("lexpatria:cookies", rouvrir);
    return () => window.removeEventListener("lexpatria:cookies", rouvrir);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement unique à l'ouverture de la page
  }, []);

  const parcours = /^\/(depot|regler|espace|avocat)/.test(chemin ?? "");
  if (choix !== null || parcours) return null;

  const decider = (c: Choix) => {
    try {
      document.cookie = `${COOKIE}=${c}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
    } catch {
      /* cookies indisponibles : le choix vaut pour la page */
    }
    setChoix(c);
    if (c === "accepte") chargerPixels(config);
  };

  return (
    <div className="consentement" role="dialog" aria-label={t("Cookies")}>
      <p>
        {t(
          "Avec votre accord, nous utilisons des cookies pour mesurer l'efficacité de nos annonces. Vous pouvez refuser : le site fonctionne de la même façon.",
        )}
      </p>
      <div className="consentement-boutons">
        <button className="btn btn-contour" onClick={() => decider("refuse")}>
          {t("Refuser")}
        </button>
        <button className="btn btn-contour" onClick={() => decider("accepte")}>
          {t("Accepter")}
        </button>
      </div>
    </div>
  );
}

export function LienCookies() {
  const t = useT();
  return (
    <button className="lien" onClick={() => window.dispatchEvent(new Event("lexpatria:cookies"))}>
      {t("Gérer les cookies")}
    </button>
  );
}
