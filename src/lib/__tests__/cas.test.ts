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
});
