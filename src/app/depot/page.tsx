import Parcours from "./Parcours";

export const metadata = { title: "Déposer mon dossier — LEXPATRIA Avocats", robots: { index: false, follow: false } };

export default async function Depot({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await searchParams;
  const source = p.c ?? p.utm_campaign ?? p.utm_source;
  return <Parcours modePhoto={p.mode === "photo"} source={source} reprise={p.reprise} />;
}
