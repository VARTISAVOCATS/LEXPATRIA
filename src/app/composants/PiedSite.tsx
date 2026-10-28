"use client";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { SITUATIONS } from "@/lib/situations";
import { LienCookies } from "../Consentement";

export default function PiedSite() {
  const t = useT();
  return (
    <div className="foot">
      <p className="lx-brand lx-brand-f">
        {t("Lexpatria Avocats est le nom commercial de la SELARL VARTIS Avocats, société d'avocats au barreau de Paris. Aide juridictionnelle non acceptée.")}
      </p>
      <span className="si-foot">
        {SITUATIONS.map((s, i) => (
          <span key={s.slug}>
            {i > 0 && " · "}
            <Link className="link" href={`/${s.slug}`}>
              {t(s.nav)}
            </Link>
          </span>
        ))}
      </span>
      <span>SELARL VARTIS Avocats · 222 boulevard Saint-Germain, 75007 Paris</span>
      <span>
        <Link className="link" href="/actualites">
          {t("Actualités")}
        </Link>
        {" · "}
        <Link className="link" href="/honoraires">
          {t("Honoraires")}
        </Link>
        {" · "}
        <Link className="link" href="/mentions-legales">
          {t("Mentions légales")}
        </Link>
        {" · "}
        <Link className="link" href="/confidentialite">
          {t("Confidentialité")}
        </Link>
      </span>
      <span>{t("Contestation des honoraires : Bâtonnier de l'Ordre des avocats de Paris.")}</span>
      <span>
        {t("Médiateur de la consommation de la profession d'avocat : 180 boulevard Haussmann, 75008 Paris.")}{" "}
        <a className="link" href="https://mediateur-consommation-avocat.fr" target="_blank" rel="noreferrer">
          mediateur-consommation-avocat.fr
        </a>
      </span>
      <span>SIREN 937 773 885 · TVA FR15937773885</span>
      <span>
        <LienCookies />
      </span>
    </div>
  );
}
