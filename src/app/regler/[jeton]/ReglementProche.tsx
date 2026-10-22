"use client";

import PaiementIntegre from "@/app/depot/PaiementIntegre";

export default function ReglementProche({ jeton, total }: { jeton: string; total: number }) {
  return (
    <PaiementIntegre
      total={total}
      verifier={() => null}
      ouvrir={async () => {
        const r = await fetch("/api/paiement", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jetonProche: jeton }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.erreur);
        return j;
      }}
      urlRetour={() => `${window.location.origin}/regler/${jeton}`}
    />
  );
}
