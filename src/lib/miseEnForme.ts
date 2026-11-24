// Mise en forme des actes sur le modèle du cabinet (recours en annulation déposé par le cabinet) :
// titre encadré en tête de la première page, « À / POUR / CONTRE » en retrait suspendu, pièces alignées à droite et en gras,
// intitulés numérotés en gras et soulignés, « En droit » et « En l'espèce » en gras, citations entre guillemets en italique,
// nom du client en gras, « PAR CES MOTIFS » centré, signature à droite, bordereau sur une nouvelle page.
// Le texte de l'acte reste du texte brut : la forme est déduite des conventions de rédaction, pour Word comme pour le PDF.

export interface Morceau {
  texte: string;
  gras?: boolean;
  italique?: boolean;
  souligne?: boolean;
  surligne?: boolean;
}

export interface Bloc {
  morceaux: Morceau[];
  align: "gauche" | "droite" | "centre" | "justifie";
  /** Retrait gauche, en vingtièmes de point (twips). */
  retrait?: number;
  /** Retrait suspendu (première ligne ramenée à gauche), en twips ; un « \t » dans le texte saute au retrait. */
  suspendu?: number;
  avant: number; // espacement avant, en twips
  apres: number; // espacement après, en twips
  separateur?: boolean; // filet centré avant le paragraphe
  sautPage?: boolean;
}

export interface ActeMisEnForme {
  titre: string | null;
  sousTitre: string | null;
  blocs: Bloc[];
}

const MAJ = /^[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŒ0-9' «»"\-–—()]+$/;
const NOM_CLIENT = /\b(?:Monsieur|Madame)\s+(?:[A-ZÀ-ÖØ-Þ][a-zà-ÿ'’-]+\s+)?[A-ZÀ-ÖØ-ÞŒ][A-ZÀ-ÖØ-ÞŒ'’ -]*[A-ZÀ-ÖØ-ÞŒ]\b/g;

/** Découpe un texte en morceaux stylés : XXX surligné, citations « … » en italique, nom du client et renvois aux pièces en gras. */
export function morceaux(texte: string, base: Omit<Morceau, "texte"> = {}): Morceau[] {
  type Zone = { debut: number; fin: number; style: Omit<Morceau, "texte"> };
  const zones: Zone[] = [];
  const marquer = (re: RegExp, style: Zone["style"]) => {
    for (const m of texte.matchAll(re)) zones.push({ debut: m.index!, fin: m.index! + m[0].length, style });
  };
  marquer(/«[^»]*»/g, { italique: true });
  marquer(NOM_CLIENT, { gras: true });
  marquer(/\(?Pi[èe]ces? n[°o]\s*\d+[^)\n;,.]*\)?/g, { gras: true });
  marquer(/XXX/g, { gras: true, surligne: true });
  // Frontières de découpage
  const bornes = new Set<number>([0, texte.length]);
  for (const z of zones) bornes.add(z.debut).add(z.fin);
  const pts = [...bornes].sort((a, b) => a - b);
  const res: Morceau[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    if (a === b) continue;
    const style = { ...base };
    for (const z of zones) if (z.debut <= a && z.fin >= b) Object.assign(style, z.style);
    const t = texte.slice(a, b);
    const prec = res[res.length - 1];
    if (prec && prec.gras === style.gras && prec.italique === style.italique && prec.souligne === style.souligne && prec.surligne === style.surligne) prec.texte += t;
    else res.push({ texte: t, ...style });
  }
  return res;
}

const p = (texte: string, o: Partial<Bloc> = {}, base: Omit<Morceau, "texte"> = {}): Bloc => ({ morceaux: morceaux(texte, base), align: "justifie", avant: 0, apres: 160, ...o });

export function mettreEnForme(texte: string): ActeMisEnForme {
  const lignes = texte.replace(/\r\n/g, "\n").split("\n");
  let titre: string | null = null;
  let sousTitre: string | null = null;
  const blocs: Bloc[] = [];
  // Présentation d'une requête (titre encadré, intitulés en capitales) seulement pour un acte juridictionnel ;
  // un courrier (recours préalable, mise en demeure, avis) garde ses lignes d'adresse telles quelles.
  const requete = /^POUR\s*:/m.test(texte);
  let avantPour = requete; // en-tête de l'acte, jusqu'à la ligne « POUR : »
  let signature = 0; // lignes restantes de la signature, alignées à droite

  for (let i = 0; i < lignes.length; i++) {
    const brut = lignes[i];
    const l = brut.trim();
    if (!l) continue;
    // Titre de l'acte (avant « POUR : ») : encadré en tête de la première page.
    if (avantPour && !titre && MAJ.test(l) && l.length > 6 && !/^(À|A)\s*:/.test(l)) {
      titre = l;
      const suiv = lignes[i + 1]?.trim() ?? "";
      if (/^\(.*\)$/.test(suiv)) {
        sousTitre = suiv.slice(1, -1);
        i++;
      }
      continue;
    }
    const entete = l.match(/^(À|POUR|CONTRE)\s*:\s*(.*)$/);
    if (entete) {
      if (entete[1] === "POUR") avantPour = false;
      const [, label, reste] = entete;
      const corps: Morceau[] =
        label === "POUR"
          ? (() => {
              const v = reste.indexOf(",");
              return v > 0 ? [{ texte: reste.slice(0, v), gras: true }, ...morceaux(reste.slice(v))] : morceaux(reste, { gras: true });
            })()
          : morceaux(reste, { gras: true });
      blocs.push({ morceaux: [{ texte: `${label} :`, gras: true, souligne: true }, { texte: "\t" }, ...corps], align: "justifie", retrait: 1410, suspendu: 1410, avant: 120, apres: 160 });
      continue;
    }
    if (/^Ayant pour avocat/.test(l)) {
      const m = l.match(/^(Ayant pour avocat\s*:?\s*)(Maître [^,]+)(.*)$/);
      blocs.push({
        morceaux: m ? [{ texte: m[1] }, { texte: m[2], gras: true }, ...morceaux(m[3])] : morceaux(l),
        align: "justifie",
        retrait: 1410,
        avant: 0,
        apres: 160,
      });
      continue;
    }
    if (/^(À l'honneur de vous exposer|Plaise au juge des référés|Plaise à la Cour|Plaise au Tribunal)/i.test(l)) {
      blocs.push(p(l, { separateur: true, avant: 240, apres: 240, align: "gauche" }));
      continue;
    }
    if (/^Pi[èe]ces? n[°o]\s*\d/.test(l) && !/^BORDEREAU/.test(l) && !lignes.slice(0, i).some((x) => /^BORDEREAU DES PI[ÈE]CES/.test(x.trim()))) {
      blocs.push({ morceaux: [{ texte: l, gras: true }], align: "droite", avant: 120, apres: 120 });
      continue;
    }
    if (/^BORDEREAU DES PI[ÈE]CES/.test(l)) {
      signature = 0;
      blocs.push({ morceaux: [{ texte: l, gras: true, souligne: true }], align: "centre", avant: 0, apres: 240, sautPage: true });
      continue;
    }
    if (/^(I|II|III|IV|V|VI)\.\s/.test(l) || /^DISCUSSION$/.test(l)) {
      blocs.push({ morceaux: [{ texte: l, gras: true, souligne: true }], align: "gauche", retrait: 360, avant: 360, apres: 200 });
      continue;
    }
    if (/^PAR CES MOTIFS/.test(l)) {
      blocs.push({ morceaux: [{ texte: l, gras: true, souligne: true }], align: "centre", avant: 480, apres: 240 });
      continue;
    }
    if (/^(À titre principal|À titre subsidiaire|À titre infiniment subsidiaire|En tout état de cause)\s*:?$/.test(l)) {
      blocs.push({ morceaux: [{ texte: l, gras: true, souligne: true }], align: "gauche", avant: 200, apres: 120 });
      continue;
    }
    if (/^En (droit|l'espèce),?$/.test(l)) {
      blocs.push({ morceaux: [{ texte: l, gras: true }], align: "gauche", avant: 160, apres: 80 });
      continue;
    }
    if (/^\d+\.\s+\S/.test(l) && l.length < 220) {
      blocs.push({ morceaux: morceaux(l, { gras: true }), align: "gauche", retrait: 360, avant: 280, apres: 160 });
      continue;
    }
    if (/^[A-H][.\-]\s+\S/.test(l) && l.length < 220) {
      blocs.push({ morceaux: morceaux(l, { gras: true, souligne: true }), align: "gauche", retrait: 720, avant: 240, apres: 160 });
      continue;
    }
    if (/^[a-h][.)]\s+\S/.test(l) && l.length < 220) {
      blocs.push({ morceaux: morceaux(l, { gras: true, italique: true, souligne: true }), align: "gauche", retrait: 1080, avant: 200, apres: 120 });
      continue;
    }
    if (/^[—–-]\s/.test(l)) {
      blocs.push(p(l.replace(/^[—–-]\s*/, "—\t"), { retrait: 720, suspendu: 360, apres: 100 }));
      continue;
    }
    if (/^(Fait à|Paris,)\s.*le\b/.test(l)) {
      signature = 3;
      blocs.push({ morceaux: morceaux(l), align: "droite", avant: 480, apres: 240 });
      continue;
    }
    if (signature > 0) {
      signature--;
      blocs.push({ morceaux: morceaux(l, /^Maître/.test(l) ? { gras: true } : {}), align: "droite", avant: 0, apres: 0 });
      continue;
    }
    // Ligne courte entièrement en capitales hors en-tête (intitulé libre) : gras centré.
    if (requete && MAJ.test(l) && l.length > 6 && l.length < 90) {
      blocs.push({ morceaux: [{ texte: l, gras: true }], align: "centre", avant: 240, apres: 160 });
      continue;
    }
    blocs.push(p(l));
  }
  return { titre, sousTitre, blocs };
}
