"use client";
import PaiementIntegre from "@/app/depot/PaiementIntegre";

export default function Regulariser({ jeton, montant }: { jeton: string; montant: number }) {
  return (
    <PaiementIntegre
      total={montant}
      moyens="ECHEANCIER"
      verifier={() => null}
      ouvrir={async () => {
        const r = await fetch("/api/echeance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jeton }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.erreur);
        return j;
      }}
      urlRetour={() => `${window.location.origin}/echeance/${encodeURIComponent(jeton)}`}
    />
  );
}
