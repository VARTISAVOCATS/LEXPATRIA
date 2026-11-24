// Acte au format Word (.docx), mis en page sur le modèle du cabinet : Times New Roman 12, texte justifié,
// marges de 2,5 cm, titre encadré en tête de la première page, numéro de page centré en pied de page.
import JSZip from "jszip";
import { mettreEnForme, type Bloc, type Morceau } from "@/lib/miseEnForme";

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function run(m: Morceau): string {
  const props = [
    m.gras ? "<w:b/><w:bCs/>" : "",
    m.italique ? "<w:i/><w:iCs/>" : "",
    m.souligne ? '<w:u w:val="single"/>' : "",
    m.surligne ? '<w:highlight w:val="yellow"/>' : "",
  ].join("");
  return m.texte
    .split("\t")
    .map((t, i) => `${i ? `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:tab/></w:r>` : ""}${t ? `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${echapper(t)}</w:t></w:r>` : ""}`)
    .join("");
}

const JC: Record<Bloc["align"], string> = { gauche: "left", droite: "right", centre: "center", justifie: "both" };

function paragraphe(b: Bloc): string {
  const ind = b.retrait || b.suspendu ? `<w:ind w:left="${b.retrait ?? 0}"${b.suspendu ? ` w:hanging="${b.suspendu}"` : ""}/>` : "";
  const tabs = b.suspendu ? `<w:tabs><w:tab w:val="left" w:pos="${b.retrait ?? b.suspendu}"/></w:tabs>` : "";
  const sep = b.separateur
    ? `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="2F5496"/></w:pBdr><w:spacing w:before="120" w:after="120"/><w:ind w:left="2835" w:right="2835"/><w:jc w:val="center"/></w:pPr></w:p>`
    : "";
  return `${sep}<w:p><w:pPr>${b.sautPage ? "<w:pageBreakBefore/>" : ""}${tabs}<w:spacing w:before="${b.avant}" w:after="${b.apres}"/>${ind}<w:jc w:val="${JC[b.align]}"/></w:pPr>${b.morceaux.map(run).join("")}</w:p>`;
}

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

export async function acteVersDocx(texte: string): Promise<Buffer> {
  const { titre, sousTitre, blocs } = mettreEnForme(texte);
  const corps = blocs.map(paragraphe).join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${sousTitre ? paragraphe({ morceaux: [{ texte: sousTitre, italique: true }], align: "centre", avant: 0, apres: 360 }) : ""}${corps}<w:sectPr><w:headerReference w:type="first" r:id="rIdEnTete"/><w:footerReference w:type="default" r:id="rIdPied"/><w:footerReference w:type="first" r:id="rIdPied"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1193" w:right="1417" w:bottom="1278" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/><w:titlePg/></w:sectPr></w:body></w:document>`;
  const enTete = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr ${NS}>${
    titre
      ? `<w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="8" w:space="4" w:color="000000"/><w:left w:val="single" w:sz="8" w:space="4" w:color="000000"/><w:bottom w:val="single" w:sz="8" w:space="4" w:color="000000"/><w:right w:val="single" w:sz="8" w:space="4" w:color="000000"/></w:pBdr><w:ind w:left="1701" w:right="1701"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:caps/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">${echapper(titre)}</w:t></w:r></w:p>`
      : "<w:p/>"
  }</w:hdr>`;
  const pied = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr ${NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdEnTete" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdPied" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`,
  );
  zip.file("word/document.xml", document);
  zip.file("word/styles.xml", styles);
  zip.file("word/header1.xml", enTete);
  zip.file("word/footer1.xml", pied);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
