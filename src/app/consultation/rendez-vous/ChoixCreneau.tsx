"use client";
// Créneaux libres des avocats (Microsoft Bookings), regroupés par jour.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLangue, useT } from "@/i18n/client";

const LOCALES: Record<string, string> = { fr: "fr-FR", en: "en-GB", es: "es-ES", ar: "ar" };

export default function ChoixCreneau({ jeton }: { jeton: string }) {
  const t = useT();
  const langue = useLangue();
  const router = useRouter();
  const [liste, setListe] = useState<{ debut: string }[] | null>(null);
  const [choix, setChoix] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const loc = LOCALES[langue] ?? "fr-FR";

  async function charger() {
    setErreur(null);
    const r = await fetch(`/api/consultation/creneaux?jeton=${encodeURIComponent(jeton)}`).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok) return setErreur(j?.erreur ?? t("Une erreur est survenue."));
    setListe(j.creneaux);
  }
  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jours = useMemo(() => {
    const m = new Map<string, { debut: string }[]>();
    for (const c of liste ?? []) {
      const j = new Date(c.debut).toLocaleDateString(loc, { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" });
      m.set(j, [...(m.get(j) ?? []), c]);
    }
    return [...m.entries()];
  }, [liste, loc]);

  async function reserver() {
    if (!choix) return;
    setEnvoi(true);
    setErreur(null);
    const r = await fetch("/api/consultation/reserver", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jeton, debut: choix }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setEnvoi(false);
    if (!r?.ok) {
      setErreur(j?.erreur ?? t("Une erreur est survenue."));
      setChoix(null);
      return charger();
    }
    router.refresh();
  }

  if (!liste && !erreur) return <p className="note">{t("Chargement des disponibilités…")}</p>;
  return (
    <div className="rdv">
      {liste && liste.length === 0 && <p className="note">{t("Aucun créneau libre pour le moment. Réessayez un peu plus tard.")}</p>}
      {jours.map(([jour, cs]) => (
        <div key={jour} className="rdv-jour">
          <b>{jour}</b>
          <div className="rdv-heures">
            {cs.map((c) => (
              <button key={c.debut} type="button" className={choix === c.debut ? "sel" : ""} onClick={() => setChoix(c.debut)}>
                {new Date(c.debut).toLocaleTimeString(loc, { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}
              </button>
            ))}
          </div>
        </div>
      ))}
      {erreur && <p className="erreur">{erreur}</p>}
      <div className="actions">
        <button className="btn cta" disabled={!choix || envoi} onClick={reserver}>
          {envoi ? t("Réservation…") : t("Confirmer ce rendez-vous")}
        </button>
      </div>
    </div>
  );
}
