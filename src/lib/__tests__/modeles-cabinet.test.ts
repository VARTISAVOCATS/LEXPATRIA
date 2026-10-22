// Modèles d'actes du cabinet : variables, versions, retour arrière, import Word, utilisation par le poste de travail.
import JSZip from "jszip";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, prochainCodeClient, prochaineReference, schema } from "@/db";
import { DONNEES_EXEMPLE, remplirModele, variablesInconnues } from "@/lib/modeles";
import { enregistrerModele, etatModeles, modeleActif, restaurerModele, texteDocx } from "@/lib/serveur/modeles-cabinet";
import { dernierActe, genererProjet } from "@/lib/serveur/poste";

const membre = async (email: string) => (await (await db()).select().from(schema.utilisateurs).where(eq(schema.utilisateurs.email, email)))[0];

async function docx(paragraphes: string[]) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphes.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`);
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

describe("variables des modèles", () => {
  it("remplit les variables et met XXX pour une donnée absente ou une variable inconnue", () => {
    const t = remplirModele("TRIBUNAL ADMINISTRATIF DE {{TRIBUNAL}}\nPOUR : {{client}}, né(e) le {{date_naissance}}, demeurant {{adresse}}\nCONTRE : {{prefet}} {{inconnue}}", DONNEES_EXEMPLE);
    expect(t).toBe("TRIBUNAL ADMINISTRATIF DE MELUN\nPOUR : Madame Nadia EXEMPLE, né(e) le XXX, demeurant 12 rue de la Paix, 94000 Créteil\nCONTRE : préfet du Val-de-Marne XXX");
    expect(variablesInconnues("{{client}} {{ inconnue }} {{faits}}")).toEqual(["inconnue"]);
  });
});

describe("modèles du cabinet", () => {
  it("s'appliquent aux nouveaux projets, se versionnent et rendent la main au modèle intégré", async () => {
    const d = await db();
    const rafik = await membre("rafik.rabia@exemple.invalid");
    const kachi = await membre("boualem.kachi@exemple.invalid");
    expect((await enregistrerModele(d, kachi, "REQUETE_REFUS_TITRE", "x")).ok).toBe(false); // associés seulement
    expect((await enregistrerModele(d, rafik, "REQUETE_REFUS_TITRE", "{{nimporte}}")).ok).toBe(false);

    // Import Word : le texte et les variables saisies dans Word sont repris.
    const texte = await texteDocx(await docx(["TRIBUNAL ADMINISTRATIF DE {{TRIBUNAL}}", "REQUÊTE — modèle VARTIS", "POUR : {{client}}", "Moyen propre au cabinet : XXX", "{{signature}}"]));
    expect(texte).toContain("REQUÊTE — modèle VARTIS");
    expect((await enregistrerModele(d, rafik, "REQUETE_REFUS_TITRE", texte, "requete.docx")).ok).toBe(true);
    expect(await modeleActif(d, "REQUETE_REFUS_TITRE")).toBe(texte);

    const [c] = await d.insert(schema.clients).values({ code: await prochainCodeClient(d), email: "modele@exemple.invalid", prenom: "Ali", nom: "Test", civilite: "MONSIEUR" }).returning();
    const [dos] = await d
      .insert(schema.dossiers)
      .values({ reference: await prochaineReference(d), clientId: c.id, procedure: "REFUS_TITRE", statut: "PRIS_EN_CHARGE", avocatId: kachi.id, prefecture: "Préfecture de police" })
      .returning();
    expect((await genererProjet(d, kachi, dos, "REQUETE_REFUS_TITRE")).ok).toBe(true);
    const acte = (await dernierActe(d, dos.id))!;
    expect(acte.contenu).toContain("TRIBUNAL ADMINISTRATIF DE PARIS");
    expect(acte.contenu).toContain("Monsieur Ali TEST");
    expect(acte.contenu).toContain("Moyen propre au cabinet : XXX");

    // Retour au modèle intégré, puis rétablissement de la version du cabinet.
    expect((await enregistrerModele(d, rafik, "REQUETE_REFUS_TITRE", "")).ok).toBe(true);
    expect(await modeleActif(d, "REQUETE_REFUS_TITRE")).toBeNull();
    const etat = (await etatModeles(d)).find((m) => m.code === "REQUETE_REFUS_TITRE")!;
    expect(etat.versions.map((v) => v.version)).toEqual([2, 1]);
    expect((await restaurerModele(d, rafik, etat.versions[1].id)).ok).toBe(true);
    expect(await modeleActif(d, "REQUETE_REFUS_TITRE")).toBe(texte);
  });
});
