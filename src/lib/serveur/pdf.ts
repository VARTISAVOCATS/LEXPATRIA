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

/**
 * Acte mis en page sur le modèle du cabinet (même présentation que le fichier Word) : Times 12, texte justifié,
 * titre encadré sur la première page, intitulés en gras et soulignés, pièces à droite, numéro de page centré.
 */
export async function actePdf(texte: string, titreDocument = "Acte"): Promise<Uint8Array> {
  const { mettreEnForme } = await import("@/lib/miseEnForme");
  const { titre, sousTitre, blocs } = mettreEnForme(compatible(texte.replace(/[\u00a0\u202f\u2009]/g, " ")));
  const doc = await PDFDocument.create();
  doc.setTitle(compatible(titreDocument));
  doc.setProducer("LEXPATRIA Avocats");
  const polices = {
    n: await doc.embedFont(StandardFonts.TimesRoman),
    g: await doc.embedFont(StandardFonts.TimesRomanBold),
    i: await doc.embedFont(StandardFonts.TimesRomanItalic),
    gi: await doc.embedFont(StandardFonts.TimesRomanBoldItalic),
  };
  const T = 11.5; // taille
  const H = 15; // interligne
  const MG = 70.85; // 2,5 cm
  const HAUT = 60;
  const BAS = 64;
  const largeur = A4[0] - 2 * MG;
  const noir = rgb(0, 0, 0);
  const tw = (v?: number) => (v ?? 0) / 20;
  const police = (m: { gras?: boolean; italique?: boolean }) => (m.gras && m.italique ? polices.gi : m.gras ? polices.g : m.italique ? polices.i : polices.n);

  let page = doc.addPage(A4);
  let y = A4[1] - HAUT;
  const nouvellePage = () => {
    page = doc.addPage(A4);
    y = A4[1] - HAUT;
  };

  if (titre) {
    const t = titre.toUpperCase();
    const w = polices.g.widthOfTextAtSize(t, 13);
    const boite = Math.max(w + 40, 240);
    page.drawRectangle({ x: (A4[0] - boite) / 2, y: y - 22, width: boite, height: 26, borderColor: noir, borderWidth: 0.8 });
    page.drawText(t, { x: (A4[0] - w) / 2, y: y - 14, size: 13, font: polices.g, color: noir });
    y -= 40;
  }
  if (sousTitre) {
    for (const l of couper(sousTitre, polices.i, largeur)) {
      const w = polices.i.widthOfTextAtSize(l, 10.5);
      page.drawText(l, { x: (A4[0] - w) / 2, y, size: 10.5, font: polices.i, color: noir });
      y -= 14;
    }
    y -= 10;
  }

  type Mot = { texte: string; m: (typeof blocs)[number]["morceaux"][number]; tab?: boolean; espace: boolean };
  for (const b of blocs) {
    if (b.sautPage) nouvellePage();
    y -= tw(b.avant);
    if (b.separateur) {
      if (y < BAS + 30) nouvellePage();
      page.drawLine({ start: { x: A4[0] / 2 - 80, y }, end: { x: A4[0] / 2 + 80, y }, thickness: 0.7, color: rgb(0.18, 0.33, 0.59) });
      y -= 18;
    }
    // Mots stylés
    const mots: Mot[] = [];
    for (const m of b.morceaux) {
      const parts = m.texte.split(/(\t| +)/);
      for (const part of parts) {
        if (!part) continue;
        if (part === "\t") mots.push({ texte: "", m, tab: true, espace: false });
        else if (/^ +$/.test(part)) {
          if (mots.length) mots[mots.length - 1].espace = true;
        } else mots.push({ texte: part, m, espace: false });
      }
    }
    const gauche = MG + tw(b.retrait);
    const premiere = gauche - tw(b.suspendu);
    // Découpage en lignes
    const lignes: { mots: Mot[]; x0: number }[] = [];
    let courante: Mot[] = [];
    let x0 = premiere;
    let x = x0;
    for (const mot of mots) {
      if (mot.tab) {
        courante.push(mot);
        x = Math.max(x + 4, gauche);
        continue;
      }
      const f = police(mot.m);
      const w = f.widthOfTextAtSize(mot.texte, T);
      if (x + w > MG + largeur && courante.length) {
        lignes.push({ mots: courante, x0 });
        courante = [];
        x0 = gauche;
        x = x0;
      }
      courante.push(mot);
      x += w + (mot.espace ? f.widthOfTextAtSize(" ", T) : 0);
    }
    if (courante.length) lignes.push({ mots: courante, x0 });
    // Dessin
    lignes.forEach((ligne, n) => {
      if (y < BAS) nouvellePage();
      const derniere = n === lignes.length - 1;
      const visibles = ligne.mots;
      const mesure = (mm: Mot) => (mm.tab ? 0 : police(mm.m).widthOfTextAtSize(mm.texte, T));
      const espaceN = polices.n.widthOfTextAtSize(" ", T) + 0.8;
      let utile = 0;
      let trous = 0;
      let apresTab = false;
      visibles.forEach((mm, k) => {
        utile += mesure(mm);
        if (mm.tab) apresTab = true;
        if (k < visibles.length - 1 && mm.espace) {
          utile += espaceN;
          trous++;
        }
      });
      const fin = MG + largeur;
      let cx = ligne.x0;
      if (b.align === "droite") cx = fin - utile;
      else if (b.align === "centre") cx = gauche + (fin - gauche - utile) / 2;
      const extra = b.align === "justifie" && !derniere && trous > 0 && !apresTab ? (fin - ligne.x0 - utile) / trous : 0;
      visibles.forEach((mm, k) => {
        if (mm.tab) {
          cx = Math.max(cx + 4, gauche);
          return;
        }
        const f = police(mm.m);
        const w = f.widthOfTextAtSize(mm.texte, T);
        const sp = k < visibles.length - 1 && mm.espace ? espaceN + extra : 0;
        if (mm.m.surligne) page.drawRectangle({ x: cx - 1, y: y - 3, width: w + 2, height: T + 2, color: rgb(1, 0.93, 0.2) });
        page.drawText(mm.texte, { x: cx, y, size: T, font: f, color: noir });
        if (mm.m.souligne) {
          const suite = sp && visibles[k + 1]?.m.souligne ? sp : 0;
          page.drawLine({ start: { x: cx, y: y - 1.6 }, end: { x: cx + w + suite, y: y - 1.6 }, thickness: 0.6, color: noir });
        }
        cx += w + sp;
      });
      y -= H;
    });
    y -= tw(b.apres);
  }

  const pages = doc.getPages();
  pages.forEach((pg, n) => {
    const t = String(n + 1);
    pg.drawText(t, { x: A4[0] / 2 - polices.n.widthOfTextAtSize(t, 10) / 2, y: 34, size: 10, font: polices.n, color: noir });
  });
  return doc.save();
}

/** Attestation de prise en charge : une page A4 à présenter en cas de contrôle (papier ou écran du téléphone). */
export async function attestationPdf(a: { texte: string; le: Date; reference: string; empreinte: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Attestation de prise en charge - ${a.reference}`);
  doc.setProducer("LEXPATRIA Avocats");
  const n = await doc.embedFont(StandardFonts.TimesRoman);
  const g = await doc.embedFont(StandardFonts.TimesRomanBold);
  const it = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const page = doc.addPage(A4);
  const [L, H] = A4;
  const MG = 70.85;
  const encre = rgb(0.08, 0.1, 0.16);
  const gris = rgb(0.35, 0.37, 0.42);
  const bleu = rgb(0.06, 0.12, 0.25);
  const centre = (t: string, y: number, f: PDFFont, s: number, c = encre) => page.drawText(t, { x: L / 2 - f.widthOfTextAtSize(t, s) / 2, y, size: s, font: f, color: c });

  // En-tête du cabinet
  let y = H - 72;
  centre("LEXPATRIA", y, g, 20, bleu);
  y -= 16;
  centre("A V O C A T S", y, n, 10, bleu);
  y -= 16;
  centre(compatible("SELARL VARTIS Avocats · Avocats au barreau de Paris"), y, n, 9.5, gris);
  y -= 12;
  centre("222 boulevard Saint-Germain, 75007 Paris", y, n, 9.5, gris);
  y -= 14;
  page.drawLine({ start: { x: MG, y }, end: { x: L - MG, y }, thickness: 0.6, color: bleu });

  // Titre encadré
  y -= 58;
  const titre = "ATTESTATION DE PRISE EN CHARGE";
  const lt = g.widthOfTextAtSize(titre, 14);
  page.drawRectangle({ x: L / 2 - lt / 2 - 18, y: y - 9, width: lt + 36, height: 30, borderColor: encre, borderWidth: 0.8 });
  centre(titre, y, g, 14);

  // Corps : paragraphes justifiés, puis « Fait à » et signature alignés à droite
  y -= 60;
  const T = 12;
  const IL = 18;
  const largeur = L - 2 * MG;
  const paragraphes = compatible(a.texte.replace(/[   ]/g, " ")).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  for (const p of paragraphes) {
    const droite = /^(Fait à|Maître )/.test(p);
    if (droite) {
      y -= /^Fait à/.test(p) ? 10 : 0;
      for (const l of p.split("\n")) {
        const f = /^Maître/.test(l) ? g : n;
        page.drawText(l, { x: L - MG - f.widthOfTextAtSize(l, T), y, size: T, font: f, color: encre });
        y -= IL;
      }
      y -= 8;
      continue;
    }
    const mots = p.split(/\s+/);
    let ligne: string[] = [];
    const tracer = (mots: string[], justifier: boolean) => {
      const brut = mots.join(" ");
      if (!justifier || mots.length < 2) page.drawText(brut, { x: MG, y, size: T, font: n, color: encre });
      else {
        const espace = (largeur - mots.reduce((s, m) => s + n.widthOfTextAtSize(m, T), 0)) / (mots.length - 1);
        let x = MG;
        for (const m of mots) {
          page.drawText(m, { x, y, size: T, font: n, color: encre });
          x += n.widthOfTextAtSize(m, T) + espace;
        }
      }
      y -= IL;
    };
    for (const m of mots) {
      if (n.widthOfTextAtSize([...ligne, m].join(" "), T) > largeur && ligne.length) {
        tracer(ligne, true);
        ligne = [];
      }
      ligne.push(m);
    }
    if (ligne.length) tracer(ligne, false);
    y -= 10;
  }

  // Pied : traçabilité de l'attestation
  const le = a.le.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
  const pied1 = compatible(`Dossier ${a.reference} · attestation établie par l'avocat depuis l'espace cabinet le ${le}`);
  const pied2 = compatible(`Empreinte du texte : ${a.empreinte.slice(0, 16)} · lexpatria.fr`);
  page.drawLine({ start: { x: MG, y: 78 }, end: { x: L - MG, y: 78 }, thickness: 0.4, color: gris });
  centre(pied1, 62, it, 8.5, gris);
  centre(pied2, 50, it, 8.5, gris);
  return doc.save();
}
