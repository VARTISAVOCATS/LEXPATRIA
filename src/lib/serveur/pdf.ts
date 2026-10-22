// Production de PDF (sans dépendance native) : actes et avis pour l'envoi recommandé, le dépôt Télérecours
// et le classement SharePoint ; assemblage des fichiers d'une pièce (PDF et images) en un seul PDF.

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const A4: [number, number] = [595.28, 841.89];
const MARGE = 64;
const TAILLE = 11;
const INTERLIGNE = 15;

/** Les polices standard ne couvrent que le jeu WinAnsi : on remplace les rares caractères hors de ce jeu. */
export function compatible(texte: string): string {
  return texte
    .replace(/[‐-‒−]/g, "-")
    .replace(/ | /g, " ")
    .replace(/[≤]/g, "<=")
    .replace(/[≥]/g, ">=")
    .replace(/[^\x09\x0a\x0d\x20-\x7e -ÿŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]/g, "?");
}

function couper(texte: string, police: PDFFont, largeur: number): string[] {
  const lignes: string[] = [];
  for (const paragraphe of texte.split("\n")) {
    if (!paragraphe.trim()) {
      lignes.push("");
      continue;
    }
    let ligne = "";
    for (const mot of paragraphe.split(/\s+/)) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (police.widthOfTextAtSize(essai, TAILLE) <= largeur) ligne = essai;
      else {
        if (ligne) lignes.push(ligne);
        ligne = mot;
      }
    }
    lignes.push(ligne);
  }
  return lignes;
}

/** Texte brut → PDF A4 paginé, numéroté en pied de page. */
export async function texteVersPdf(texte: string, titre = "Document"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(compatible(titre));
  doc.setProducer("LEXPATRIA Avocats");
  const police = await doc.embedFont(StandardFonts.TimesRoman);
  const lignes = couper(compatible(texte), police, A4[0] - 2 * MARGE);
  const parPage = Math.floor((A4[1] - 2 * MARGE) / INTERLIGNE);
  const pages = Math.max(1, Math.ceil(lignes.length / parPage));
  for (let n = 0; n < pages; n++) {
    const page = doc.addPage(A4);
    lignes.slice(n * parPage, (n + 1) * parPage).forEach((l, i) => {
      page.drawText(l, { x: MARGE, y: A4[1] - MARGE - i * INTERLIGNE, size: TAILLE, font: police, color: rgb(0.08, 0.1, 0.16) });
    });
    const pied = `${n + 1} / ${pages}`;
    page.drawText(pied, { x: A4[0] / 2 - police.widthOfTextAtSize(pied, 9) / 2, y: MARGE / 2, size: 9, font: police, color: rgb(0.4, 0.4, 0.45) });
  }
  return doc.save();
}

/** Assemble les fichiers d'une pièce (PDF, JPEG, PNG) en un seul PDF. Les autres formats sont ignorés. */
export async function assembler(fichiers: { mime: string; donnees: Uint8Array }[]): Promise<Uint8Array | null> {
  const doc = await PDFDocument.create();
  for (const f of fichiers) {
    if (f.mime === "application/pdf") {
      const source = await PDFDocument.load(f.donnees, { ignoreEncryption: true });
      for (const p of await doc.copyPages(source, source.getPageIndices())) doc.addPage(p);
    } else if (f.mime === "image/jpeg" || f.mime === "image/png") {
      const img = f.mime === "image/png" ? await doc.embedPng(f.donnees) : await doc.embedJpg(f.donnees);
      const echelle = Math.min((A4[0] - 2 * 36) / img.width, (A4[1] - 2 * 36) / img.height, 1);
      const w = img.width * echelle;
      const h = img.height * echelle;
      const page = doc.addPage(A4);
      page.drawImage(img, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
    }
  }
  return doc.getPageCount() ? doc.save() : null;
}
