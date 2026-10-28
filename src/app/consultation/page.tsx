import { db } from "@/db";
import { tServeur } from "@/i18n/serveur";
import { meta } from "@/lib/seo";
import { contenusPublics } from "@/lib/serveur/parametres";
import { EnteteParcours } from "../composants/Entete";
import { Visages } from "../composants/Vitrine";
import FormulaireConsultation from "./FormulaireConsultation";

export const metadata = meta(
  "Consulter un avocat en droit des étrangers en visio — LEXPATRIA Avocats",
  "Entretien de 30 minutes en visio avec un avocat au barreau de Paris. Vous choisissez le créneau après le paiement.",
  "/consultation",
);

export default async function Consultation({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await searchParams;
  const { t } = await tServeur();
  const { avocats } = await contenusPublics(await db());
  return (
    <>
      <EnteteParcours />
      <main className="acc">
        <div className="wrap pg-consult">
          <FormulaireConsultation source={p.c ?? p.utm_campaign ?? p.utm_source} />
          <aside className="pg-cote">
            <div className="pg-carte">
              <Visages avocats={avocats} petit />
              <h3>{t("Un échange avec un avocat du cabinet")}</h3>
              <p>{t("L'avocat lit votre message avant le rendez-vous.")}</p>
              <ul className="pg-coches">
                <li>{t("30 minutes, en visio")}</li>
                <li>{t("Le créneau de votre choix")}</li>
                <li>{t("Avocat au barreau de Paris")}</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
