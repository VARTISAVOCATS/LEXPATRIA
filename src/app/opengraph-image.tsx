// Image d'aperçu partagée sur les réseaux et les messageries (1200 × 630), générée à la construction.
import { ImageResponse } from "next/og";

export const alt = "LEXPATRIA Avocats — avocats au barreau de Paris, droit des étrangers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "#0f1e3d", color: "#ffffff" }}>
        <div style={{ fontSize: 96, letterSpacing: 18, display: "flex" }}>LEXPATRIA</div>
        <div style={{ width: 520, height: 2, background: "#c9a45c", margin: "18px 0" }} />
        <div style={{ fontSize: 40, letterSpacing: 14, display: "flex" }}>AVOCATS</div>
        <div style={{ fontSize: 34, marginTop: 56, color: "#d9dfeb", display: "flex" }}>Avocats au barreau de Paris · Droit des étrangers</div>
        <div style={{ fontSize: 28, marginTop: 16, color: "#c9a45c", display: "flex" }}>OQTF · Titre de séjour · Visa · Naturalisation</div>
      </div>
    ),
    size,
  );
}
