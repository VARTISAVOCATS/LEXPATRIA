import { EnteteParcours } from "../composants/Entete";
import FormulaireConsultation from "./FormulaireConsultation";

export const metadata = {
  title: "Consultation en visio avec un avocat — LEXPATRIA Avocats",
  description: "Un entretien de 30 minutes en visio avec un avocat au barreau de Paris, au créneau de votre choix.",
};

export default async function Consultation({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await searchParams;
  return (
    <>
      <EnteteParcours />
      <main>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <FormulaireConsultation source={p.c ?? p.utm_campaign ?? p.utm_source} />
        </div>
      </main>
    </>
  );
}
