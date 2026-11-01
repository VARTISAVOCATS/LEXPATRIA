import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { CAS_DEFAUT, schemaReferentiel } from "../cas";
import { controlerTexte } from "../deontologie";
import { textesDe } from "../parametres";
import { composerOffre, TARIFS_DEFAUT } from "../procedures";
import { trier } from "../triage";

function client(reponse: object) {
  return { messages: { create: async () => ({ content: [{ type: "text", text: JSON.stringify(reponse) }] }) } } as unknown as Anthropic;
}
const base = {
  horsPerimetreMotif: null, situationOQTF: null, detentionOuRetention: false, dateDecision: null, dateNotification: null,
  dateDemande: null, dateEcheance: null, visaType: null, naturalisationIssue: null, emploiMenace: null, prefecture: null,
  nationaliteAlgerienne: null, langue: "fr", faits: [], ceQueLeRecoursPeutObtenir: "", traduction: null,
};

describe("référentiel des cas", () => {
  it("le référentiel intégré est valide et respecte le filtre déontologique", () => {
    expect(schemaReferentiel.safeParse(CAS_DEFAUT).success).toBe(true);
    for (const t of textesDe(CAS_DEFAUT)) expect(controlerTexte(t), t).toEqual([]);
  });

  it("le cas reconnu fixe la procédure et les éléments qu'il détermine", async () => {
    const r = await trier(
      { recit: "Ma demande d'asile a été rejetée et j'ai reçu une OQTF" },
      client({ ...base, procedure: "REFUS_TITRE", cas: "OQTF_APRES_ASILE", confiance: "HAUTE", qualification: { decision: "OQTF", autorite: null, mesures: [], motif: null, aVerifier: [] } }),
    );
    expect(r.procedure).toBe("OQTF");
    expect(r.situationOQTF).toBe("LIBRE_APRES_ASILE");
  });

  it("un code inconnu est écarté : procédure la plus proche, confiance faible", async () => {
    const r = await trier({ recit: "Refus de carte de commerçant" }, client({ ...base, procedure: "REFUS_TITRE", cas: "INVENTE", confiance: "HAUTE" }));
    expect(r.cas).toBeNull();
    expect(r.confiance).toBe("FAIBLE");
    expect(r.procedure).toBe("REFUS_TITRE");
  });

  it("le refus de renouvellement ajoute le référé-suspension au devis", () => {
    const cas = CAS_DEFAUT.find((c) => c.code === "REFUS_RENOUVELLEMENT")!;
    const offre = composerOffre("REFUS_TITRE", { urgence: false, complements: cas.complements }, TARIFS_DEFAUT);
    expect(offre.map((l) => l.diligence)).toEqual(["REQUETE", "REFERE_SUSPENSION_AVEC_REQUETE"]);
  });

  it("un cas de référé-liberté passe au référé d'emblée, sans question sur l'urgence", async () => {
    const r = await trier(
      { recit: "La police a gardé mon passeport et je dois partir pour l'enterrement de mon père" },
      client({ ...base, procedure: "BLOCAGE_SIMPLE", cas: "DOCUMENTS_RETENUS", confiance: "HAUTE" }),
    );
    expect(r.procedure).toBe("BLOCAGE_EMPLOI");
    expect(r.emploiMenace).toBe(true);
    const offre = composerOffre("BLOCAGE_EMPLOI", { urgence: false, refere: "LIBERTE" }, TARIFS_DEFAUT);
    expect(offre[0].diligence).toBe("REFERE_LIBERTE");
  });

  it("un cas de référé mesures utiles laisse la mise en demeure sans urgence établie", async () => {
    const r = await trier({ recit: "Impossible d'avoir un rendez-vous" }, client({ ...base, procedure: "BLOCAGE_SIMPLE", cas: "RENDEZ_VOUS_IMPOSSIBLE", confiance: "HAUTE" }));
    expect(r.procedure).toBe("BLOCAGE_SIMPLE");
    expect(r.emploiMenace).toBeNull();
    expect(composerOffre("BLOCAGE_EMPLOI", { urgence: false, refere: "MESURES_UTILES" }, TARIFS_DEFAUT)[0].diligence).toBe("REFERE_MESURES_UTILES");
  });

  it("une naturalisation sans suite n'est jamais orientée vers un recours contre un refus", async () => {
    const recit = "J'ai déposé sur l'ANEF une demande de naturalisation le 1er août 2025 ; plus d'un an après, le dossier est toujours « dossier envoyé ».";
    const parDefaut = await trier({ recit }, client({ ...base, procedure: "DIAGNOSTIC" }));
    expect(parDefaut.cas).toBe("NATURALISATION_SANS_SUITE");
    const r = await trier({ recit }, client({ ...base, procedure: "NATURALISATION", cas: "NATURALISATION_SANS_SUITE", confiance: "HAUTE" }));
    expect(r.procedure).toBe("BLOCAGE_SIMPLE");
    expect(r.emploiMenace).toBe(false);
  });

  it("sans fiche, la qualification libre de l'IA fixe la procédure, dans le cadre du schéma", async () => {
    const casLibre = {
      libelle: "Refus d'échange de permis de conduire étranger",
      voieClient: "Requête en annulation devant le tribunal administratif",
      procedure: "REFUS_TITRE",
      situationOQTF: null, visaType: null, naturalisationIssue: null,
      signes: "Refus de la préfecture d'échanger un permis de conduire étranger contre un permis français.",
      juridiction: "Tribunal administratif du ressort de la préfecture.",
      delai: "Deux mois à compter de la notification.",
      refere: null, implicite: false, complements: [], modele: "REQUETE_REFUS_TITRE", vigilance: [],
    };
    const r = await trier({ recit: "La préfecture refuse d'échanger mon permis algérien" }, client({ ...base, procedure: "DIAGNOSTIC", cas: null, casLibre }));
    expect(r.procedure).toBe("REFUS_TITRE");
    expect(r.casLibre).not.toBeNull();
    const invalide = await trier({ recit: "x" }, client({ ...base, procedure: "DIAGNOSTIC", casLibre: { libelle: "x" } }));
    expect(invalide.casLibre).toBeNull();
  });

  it("le rejet implicite d'une naturalisation après récépissé ouvre le recours préalable", async () => {
    const r = await trier({ recit: "Récépissé de complétude reçu il y a deux ans, aucune décision" }, client({ ...base, procedure: "NATURALISATION", cas: "NATURALISATION_REJET_IMPLICITE", confiance: "HAUTE" }));
    expect(r.procedure).toBe("NATURALISATION");
    expect(CAS_DEFAUT.find((c) => c.code === "NATURALISATION_REJET_IMPLICITE")!.implicite).toBe(true);
  });

  it("plus de question de précision après deux réponses", async () => {
    const question = { texte: "Avez-vous reçu une décision écrite ?", options: ["Oui", "Non"] };
    const r1 = await trier({ recit: "Problème de papiers" }, client({ ...base, procedure: "DIAGNOSTIC", question }));
    expect(r1.question).not.toBeNull();
    const precisions = [{ question: "a ?", reponse: "Oui" }, { question: "b ?", reponse: "Non" }];
    const r2 = await trier({ recit: "Problème de papiers", precisions }, client({ ...base, procedure: "DIAGNOSTIC", question }));
    expect(r2.question).toBeNull();
  });

  it("une naturalisation n'est jamais orientée vers le refus implicite d'un titre de séjour", async () => {
    const recit = "J'ai déposé ma demande de naturalisation sur ANEF depuis le 1er août 2025. Le statut est encore « dossier envoyé ».";
    const r = await trier({ recit }, client({ ...base, procedure: "REFUS_IMPLICITE", cas: null }));
    expect(r.cas).toBe("NATURALISATION_SANS_SUITE");
    expect(r.procedure).toBe("BLOCAGE_SIMPLE");
  });
});
