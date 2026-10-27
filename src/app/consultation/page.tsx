import { db } from "@/db";
import { tServeur } from "@/i18n/serveur";
import { contenusPublics } from "@/lib/serveur/parametres";
import { EnteteParcours } from "../composants/Entete";
import { Visages } from "../composants/Vitrine";
import FormulaireConsultation from "./FormulaireConsultation";

export const metadata = {
  title: "Consultation en visio avec un avocat — LEXPATRIA Avocats",
  description: "Un entretien de 30 minutes en visio avec un avocat au barreau de Paris, au créneau de votre choix.",
};

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
              <p>{t("Vous posez vos questions de vive voix à un avocat qui a pris connaissance de votre message avant le rendez-vous et vous indique ce que permet votre situation.")}</p>
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
