// Production de PDF (sans dépendance native) : actes et avis pour l'envoi recommandé, le dépôt Télérecours
// et le classement SharePoint ; assemblage des fichiers d'une pièce (PDF et images) en un seul PDF.

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont } from "pdf-lib";

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

/** Attestation remise au client après le dépôt du recours : une page A4 en filigrane, à présenter en cas de contrôle. */
export async function attestationPdf(a: {
  texte: string;
  le: Date;
  reference: string;
  empreinte: string;
  sousTitre?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Attestation - ${a.reference}`);
  doc.setProducer("LEXPATRIA Avocats");
  const n = await doc.embedFont(StandardFonts.TimesRoman);
  const g = await doc.embedFont(StandardFonts.TimesRomanBold);
  const it = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const page = doc.addPage(A4);
  const [L, H] = A4;
  const MG = 72;
  const encre = rgb(0.08, 0.1, 0.16);
  const gris = rgb(0.38, 0.4, 0.46);
  const bleu = rgb(0.07, 0.13, 0.27);
  const rouge = rgb(0.75, 0.16, 0.14);
  const centre = (t: string, y: number, f: PDFFont, s: number, c = encre, espace = 0) => {
    const l = f.widthOfTextAtSize(t, s) + espace * (t.length - 1);
    if (!espace) return page.drawText(t, { x: L / 2 - l / 2, y, size: s, font: f, color: c });
    let x = L / 2 - l / 2;
    for (const ch of t) {
      page.drawText(ch, { x, y, size: s, font: f, color: c });
      x += f.widthOfTextAtSize(ch, s) + espace;
    }
  };

  // Filigrane : trame diagonale de micro-texte, puis le nom du cabinet en grand, en travers de la page.
  const trame = compatible(`LEXPATRIA AVOCATS · ${a.reference} · `).repeat(14);
  for (let k = -12; k < 26; k++)
    page.drawText(trame, { x: -260, y: k * 34, size: 6.5, font: n, color: bleu, opacity: 0.045, rotate: degrees(35) });
  const fil = "LEXPATRIA";
  const tf = 88;
  const lf = g.widthOfTextAtSize(fil, tf);
  const ang = (35 * Math.PI) / 180;
  // Centre du mot placé au centre de la page (rotation autour de l'origine du texte).
  const cx = (lf / 2) * Math.cos(ang) - 0.35 * tf * Math.sin(ang);
  const cy = (lf / 2) * Math.sin(ang) + 0.35 * tf * Math.cos(ang);
  page.drawText(fil, { x: L / 2 - cx, y: H / 2 - 30 - cy, size: tf, font: g, color: bleu, opacity: 0.06, rotate: degrees(35) });

  // Double filet d'encadrement
  page.drawRectangle({ x: 26, y: 26, width: L - 52, height: H - 52, borderColor: bleu, borderWidth: 1.2 });
  page.drawRectangle({ x: 31, y: 31, width: L - 62, height: H - 62, borderColor: bleu, borderWidth: 0.4 });

  // En-tête : logotype (LEXPATRIA, filet et losange rouge, AVOCATS), puis la société
  let y = H - 88;
  centre("LEXPATRIA", y, g, 24, bleu, 2.2);
  y -= 12;
  page.drawLine({ start: { x: L / 2 - 70, y }, end: { x: L / 2 - 6, y }, thickness: 0.7, color: bleu });
  page.drawLine({ start: { x: L / 2 + 6, y }, end: { x: L / 2 + 70, y }, thickness: 0.7, color: bleu });
  page.drawRectangle({ x: L / 2, y: y - 3.2, width: 4.5, height: 4.5, color: rouge, rotate: degrees(45) });
  y -= 15;
  centre("AVOCATS", y, n, 10, bleu, 3.2);
  y -= 20;
  centre(compatible("SELARL VARTIS Avocats · Avocats au barreau de Paris"), y, it, 10, gris);
  y -= 13;
  centre("222 boulevard Saint-Germain, 75007 Paris", y, it, 10, gris);

  // Titre
  y -= 52;
  centre("ATTESTATION", y, g, 20, bleu, 4);
  y -= 18;
  centre(compatible(a.sousTitre ?? "Prise en charge et dépôt du recours"), y, it, 11.5, gris);

  y -= 48;

  // Corps : paragraphes justifiés ; « Fait à » et signature à droite
  const T = 12;
  const IL = 17.5;
  const largeur = L - 2 * MG;
  const paragraphes = compatible(a.texte.replace(/[   ]/g, " ")).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  for (const p of paragraphes) {
    if (/^(Fait à|Maître )/.test(p)) {
      const signature = /^Maître /.test(p);
      if (!signature) y -= 6;
      const lignes = signature ? [p, "Avocat au barreau de Paris"] : [p];
      lignes.forEach((l, k) => {
        const f = signature ? (k === 0 ? g : it) : n;
        const s = signature && k > 0 ? 10.5 : T;
        page.drawText(l, { x: L - MG - f.widthOfTextAtSize(l, s), y, size: s, font: f, color: encre });
        y -= signature && k === 0 ? 14 : IL;
      });
      y -= 6;
      continue;
    }
    let ligne: string[] = [];
    const tracer = (mots: string[], justifier: boolean) => {
      if (!justifier || mots.length < 2) page.drawText(mots.join(" "), { x: MG, y, size: T, font: n, color: encre });
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
    for (const m of p.split(/\s+/)) {
      if (n.widthOfTextAtSize([...ligne, m].join(" "), T) > largeur && ligne.length) {
        tracer(ligne, true);
        ligne = [];
      }
      ligne.push(m);
    }
    if (ligne.length) tracer(ligne, false);
    y -= 9;
  }

  // Pied : traçabilité
  const le = a.le.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
  page.drawLine({ start: { x: MG, y: 74 }, end: { x: L - MG, y: 74 }, thickness: 0.4, color: gris });
  centre(compatible(`Attestation établie par l'avocat depuis l'espace sécurisé du cabinet le ${le} · dossier ${a.reference}`), 60, it, 8, gris);
  centre(compatible(`Empreinte du texte : ${a.empreinte.slice(0, 16)} · lexpatria.fr`), 49, it, 8, gris);
  return doc.save();
}
