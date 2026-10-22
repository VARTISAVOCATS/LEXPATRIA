import { describe, expect, it } from "vitest";
import { ajouterHeuresOuvrees, estFerie, estOuvre, jour, joursOuvresEntre } from "../calendrier";
import { evaluerDelai } from "../delais";
import { controlerTexte } from "../deontologie";
import { formatEuros, troisFois, TARIFS_DEFAUT } from "../procedures";

const iso = (d?: Date) => d?.toISOString().slice(0, 10);

describe("calendrier", () => {
  it("reconnaît les jours fériés mobiles 2026", () => {
    expect(estFerie(jour(2026, 4, 6))).toBe(true); // lundi de Pâques
    expect(estFerie(jour(2026, 5, 14))).toBe(true); // Ascension
    expect(estFerie(jour(2026, 5, 25))).toBe(true); // Pentecôte
    expect(estFerie(jour(2026, 11, 11))).toBe(true);
    expect(estOuvre(jour(2026, 10, 20))).toBe(true); // mardi
    expect(estOuvre(jour(2026, 10, 24))).toBe(false); // samedi
  });

  it("compte les jours ouvrés", () => {
    // du ven. 30 oct. (exclu) au mer. 4 nov. 2026 : lun. 2, mar. 3, mer. 4 (le 1er nov. est un dimanche)
    expect(joursOuvresEntre(jour(2026, 10, 30), jour(2026, 11, 4))).toBe(3);
  });

  it("ajoute des heures ouvrées en sautant le week-end", () => {
    // vendredi 23 oct. 2026 à 18 h (Paris, UTC+2) + 2 h ouvrées → lundi 26 à 10 h
    const r = ajouterHeuresOuvrees(new Date("2026-10-23T16:00:00Z"), 2);
    expect(iso(r.jour)).toBe("2026-10-26");
    expect(r.minutes).toBe(10 * 60);
  });
});

describe("délais de recours", () => {
  const auj = jour(2026, 10, 20);

  it("OQTF libre : un mois, avis préalable possible", () => {
    const r = evaluerDelai({ procedure: "OQTF", situationOQTF: "LIBRE", dateReference: jour(2026, 10, 15), aujourdhui: auj });
    expect(iso(r.dateLimite)).toBe("2026-11-15");
    expect(r.traitement).toBe("NORMAL");
    expect(r.avisPossible).toBe(true);
  });

  it("OQTF assigné à résidence : 7 jours, urgence sous 3 jours ouvrés", () => {
    const r = evaluerDelai({ procedure: "OQTF", situationOQTF: "ASSIGNE", dateReference: jour(2026, 10, 15), aujourdhui: auj });
    expect(iso(r.dateLimite)).toBe("2026-10-22");
    expect(r.traitement).toBe("URGENCE");
    expect(r.avisPossible).toBe(false);
  });

  it("OQTF en rétention ou en détention : refus avant paiement", () => {
    expect(evaluerDelai({ procedure: "OQTF", situationOQTF: "RETENTION", aujourdhui: auj }).traitement).toBe("REFUSE");
    expect(evaluerDelai({ procedure: "OQTF", situationOQTF: "DETENTION", aujourdhui: auj }).motifRefus).toBe("DETENTION");
  });

  it("moins de 10 jours : procédure directe, pas d'avis préalable", () => {
    const r = evaluerDelai({ procedure: "REFUS_VISA", dateReference: jour(2026, 9, 28), aujourdhui: auj });
    expect(iso(r.dateLimite)).toBe("2026-10-28");
    expect(r.traitement).toBe("DIRECT");
  });

  it("date inconnue : procédure directe", () => {
    const r = evaluerDelai({ procedure: "REFUS_TITRE", aujourdhui: auj });
    expect(r.traitement).toBe("DIRECT");
    expect(r.dateInconnue).toBe(true);
  });

  it("délai déclaré dépassé : pas de paiement de procédure", () => {
    const r = evaluerDelai({ procedure: "OQTF", situationOQTF: "LIBRE", dateReference: jour(2026, 8, 1), aujourdhui: auj });
    expect(r.traitement).toBe("EXPIRE");
  });

  it("refus implicite : né à 4 mois, recours dans les 2 mois", () => {
    const r = evaluerDelai({ procedure: "REFUS_IMPLICITE", dateDemande: jour(2026, 5, 10), aujourdhui: auj });
    expect(iso(r.dateLimite)).toBe("2026-11-10");
    const nonNe = evaluerDelai({ procedure: "REFUS_IMPLICITE", dateDemande: jour(2026, 8, 1), aujourdhui: auj });
    expect(iso(nonNe.refusImpliciteNonNe?.dateNaissance)).toBe("2026-12-01");
  });
});

describe("tarifs et déontologie", () => {
  it("paiement en trois fois", () => {
    expect(troisFois(TARIFS_DEFAUT.REQUETE)).toEqual([33_000, 33_000, 33_000]);
    expect(formatEuros(TARIFS_DEFAUT.REQUETE + TARIFS_DEFAUT.REFERE_SUSPENSION_AVEC_REQUETE).replace(/\s/g, " ")).toBe("1 480 €");
  });

  it("filtre les mots interdits", () => {
    expect(controlerTexte("Premier échange gratuit").map((i) => i.motif)).toContain("gratuit");
    expect(controlerTexte("Nos avocats du barreau de Paris").length).toBe(1);
    expect(controlerTexte("Prise en charge sous 48 heures ouvrées par un avocat du cabinet").length).toBe(0);
  });
});

import { texteConvention } from "../convention";

describe("convention", () => {
  it("passe le filtre déontologique", () => {
    const t = texteConvention({
      reference: "D1001",
      procedureLibelle: "Recours contre une OQTF",
      recoursPrealable: false,
      lignes: [{ diligence: "REQUETE", libelle: "Requête", montant: 99_000 }],
      troisFois: true,
    });
    expect(controlerTexte(t)).toEqual([]);
    expect(t).toContain("990 € TTC");
  });
});

describe("cas ajoutés après l'audit", () => {
  const auj = jour(2026, 10, 20);
  it("OQTF, situation inconnue : 7 jours par prudence", () => {
    const r = evaluerDelai({ procedure: "OQTF", situationOQTF: "INCONNUE", dateReference: jour(2026, 10, 15), aujourdhui: auj });
    expect(iso(r.dateLimite)).toBe("2026-10-22");
  });
  it("procédure en cours : échéance proche = urgence, jamais d'avis préalable", () => {
    const r = evaluerDelai({ procedure: "PROCEDURE_EN_COURS", dateEcheance: jour(2026, 10, 21), aujourdhui: auj });
    expect(r.traitement).toBe("URGENCE");
    const r2 = evaluerDelai({ procedure: "PROCEDURE_EN_COURS", dateEcheance: jour(2026, 12, 21), aujourdhui: auj });
    expect(r2.avisPossible).toBe(false);
    const r3 = evaluerDelai({ procedure: "PROCEDURE_EN_COURS", aujourdhui: auj });
    expect(r3.avisPossible).toBe(false);
  });
  it("refus implicite né depuis plus de deux mois : délai déclaré dépassé", () => {
    const r = evaluerDelai({ procedure: "REFUS_IMPLICITE", dateDemande: jour(2026, 3, 2), aujourdhui: auj });
    expect(r.traitement).toBe("EXPIRE");
  });
});

import { instantParis } from "../calendrier";
describe("heure de Paris", () => {
  it("convertit 10 h à Paris en UTC, été comme hiver", () => {
    expect(instantParis(jour(2026, 10, 20), 600).toISOString()).toBe("2026-10-20T08:00:00.000Z");
    expect(instantParis(jour(2026, 12, 1), 600).toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });
});

import { SITUATIONS } from "../situations";
import { CONTENUS, SUGGESTIONS } from "../contenus";
describe("textes publiés", () => {
  it("passent tous le filtre déontologique", () => {
    const tout = JSON.stringify([SITUATIONS, CONTENUS, SUGGESTIONS]);
    expect(controlerTexte(tout)).toEqual([]);
  });
});

import cles from "../../i18n/cles.json";
import ar from "../../i18n/ar.json";
import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
describe("traductions", () => {
  it("chaque texte du parcours est traduit en arabe, anglais et espagnol", () => {
    for (const d of [ar, en, es] as Record<string, string>[]) {
      expect((cles as string[]).filter((k) => !d[k])).toEqual([]);
    }
  });
  it("aucune traduction n'emploie de mot interdit", () => {
    const interdits = /\b(free|guarantee[ds]?|specialist|gratis|gratuit[oa]|garantizad[oa]|especialista)\b|مجان|مضمون|متخصص/i;
    for (const d of [ar, en, es] as Record<string, string>[]) expect(Object.values(d).filter((v) => interdits.test(v))).toEqual([]);
  });
});
