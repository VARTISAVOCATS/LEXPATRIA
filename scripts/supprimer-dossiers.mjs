// Suppression définitive des dossiers de test (base, pièces sur le serveur et dans le stockage objet).
// Sans --confirmer : affiche seulement la liste de ce qui serait supprimé et de ce qui est conservé.
// Le dossier de première instance d'un dossier conservé est conservé aussi (lien d'appel).
// Ne touche pas aux copies SharePoint, aux paiements Stripe ni aux factures Pennylane.
// Usage sur le serveur :
//   cd /opt/lexpatria && sudo docker compose exec app node outils/supprimer-dossiers.mjs garder D1015
//   cd /opt/lexpatria && sudo docker compose exec app node outils/supprimer-dossiers.mjs garder D1015 --confirmer
import { createDecipheriv, createHash, randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

const args = process.argv.slice(2);
const confirmer = args.includes("--confirmer");
const garder = args.filter((a) => /^D\d+$/i.test(a)).map((a) => a.toUpperCase());
if (args[0] !== "garder" || garder.length === 0 || !process.env.DATABASE_URL) {
  console.error("Usage : node outils/supprimer-dossiers.mjs garder D1015 [D1016…] [--confirmer]");
  process.exit(1);
}

function dechiffrer(texte) {
  const k = process.env.CLE_CHIFFREMENT;
  if (!k || !/^[0-9a-f]{64}$/i.test(k)) return {};
  try {
    const [iv, tag, donnees] = texte.split(".").map((s) => Buffer.from(s, "base64url"));
    const d = createDecipheriv("aes-256-gcm", Buffer.from(k, "hex"), iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(donnees), d.final()]).toString("utf8"));
  } catch {
    return {};
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const q = (texte, valeurs = []) => pool.query(texte, valeurs).then((r) => r.rows);
const euros = (c) => `${(Number(c) / 100).toFixed(2).replace(".", ",")} €`;

try {
  const tous = await q(
    `select d.id, d.reference, d.statut, d.procedure, d.dossier_parent_id, d.cree_le, d.client_id, c.prenom, c.nom,
            (select count(*) from paiements p where p.dossier_id = d.id) as nb_paiements,
            (select coalesce(sum(p.montant), 0) from paiements p where p.dossier_id = d.id and p.statut = 'PAYE') as paye
       from dossiers d join clients c on c.id = d.client_id
      order by d.cree_le`,
  );
  const introuvables = garder.filter((r) => !tous.some((d) => d.reference === r));
  if (introuvables.length) {
    console.error(`Dossier(s) introuvable(s) : ${introuvables.join(", ")}. Rien n'est supprimé.`);
    process.exit(1);
  }
  const conserves = new Set(tous.filter((d) => garder.includes(d.reference)).map((d) => d.id));
  for (const d of tous) if (conserves.has(d.id) && d.dossier_parent_id) conserves.add(d.dossier_parent_id);
  const aSupprimer = tous.filter((d) => !conserves.has(d.id));
  const ligne = (d) =>
    `  ${d.reference.padEnd(7)} ${String(d.statut).padEnd(16)} ${String(d.procedure).padEnd(22)} ${`${d.prenom ?? ""} ${d.nom ?? ""}`.trim().padEnd(28)} ${new Date(d.cree_le).toLocaleDateString("fr-FR")}${Number(d.nb_paiements) ? `  paiements : ${d.nb_paiements} (${euros(d.paye)} payés)` : ""}`;

  console.log(`\nCONSERVÉS (${conserves.size}) :`);
  tous.filter((d) => conserves.has(d.id)).forEach((d) => console.log(ligne(d) + (garder.includes(d.reference) ? "" : "  ← première instance du dossier conservé")));
  console.log(`\nÀ SUPPRIMER DÉFINITIVEMENT (${aSupprimer.length}) :`);
  aSupprimer.forEach((d) => console.log(ligne(d)));

  if (!confirmer) {
    console.log("\nAucune suppression effectuée. Pour supprimer cette liste, relancez la commande avec --confirmer à la fin.\n");
    process.exit(0);
  }
  if (aSupprimer.length === 0) process.exit(0);

  // Fichiers des pièces : stockage objet (accès du back office, sinon .env) et copie éventuelle sur le serveur.
  const v = {};
  for (const l of await q("select chiffre from connexions").catch(() => [])) Object.assign(v, dechiffrer(l.chiffre));
  const lire = (n) => (v[n] || process.env[n] || "").trim() || undefined;
  const s3c = { endpoint: lire("S3_ENDPOINT"), region: lire("S3_REGION") ?? "gra", bucket: lire("S3_BUCKET"), ak: lire("S3_ACCESS_KEY"), sk: lire("S3_SECRET_KEY") };
  const s3 =
    s3c.endpoint && s3c.bucket && s3c.ak && s3c.sk
      ? new S3Client({ region: s3c.region, endpoint: s3c.endpoint, credentials: { accessKeyId: s3c.ak, secretAccessKey: s3c.sk }, forcePathStyle: true })
      : null;
  const local = process.env.STOCKAGE_LOCAL ?? path.join(process.cwd(), ".stockage");
  const ids = aSupprimer.map((d) => d.id);
  const cles = (await q("select fichiers from pieces where dossier_id = any($1)", [ids])).flatMap((p) => (p.fichiers ?? []).map((f) => f?.cle).filter(Boolean));

  await pool.query("begin");
  try {
    await q("delete from attestations where acte_id in (select id from actes where dossier_id = any($1))", [ids]);
    for (const t of ["envois", "archives", "pieces", "actes", "messages", "echeances", "conventions_acceptees", "echeancier", "paiements", "journal", "codes_connexion"])
      await q(`delete from ${t} where dossier_id = any($1)`, [ids]);
    await q("delete from dossiers where id = any($1)", [ids]);
    const clients = [...new Set(aSupprimer.map((d) => d.client_id))];
    await q("delete from codes_connexion where client_id = any($1) and not exists (select 1 from dossiers where client_id = codes_connexion.client_id)", [clients]);
    const sup = await q("delete from clients where id = any($1) and not exists (select 1 from dossiers where client_id = clients.id) returning id", [clients]);
    // Entrée du journal général (chaînée comme dans l'application).
    const [derniere] = await q("select empreinte from journal where dossier_id is null order by cree_le desc limit 1");
    const precedente = derniere?.empreinte ?? null;
    const details = { references: aSupprimer.map((d) => d.reference), conserves: garder };
    const le = new Date();
    const empreinte = createHash("sha256").update(JSON.stringify([precedente, null, "SYSTEME", "DOSSIERS_TEST_SUPPRIMES", details, le.toISOString()])).digest("hex");
    await q("insert into journal (id, acteur, action, details, empreinte, precedente, cree_le) values ($1, 'SYSTEME', 'DOSSIERS_TEST_SUPPRIMES', $2, $3, $4, $5)", [
      randomBytes(12).toString("hex"),
      JSON.stringify(details),
      empreinte,
      precedente,
      le,
    ]);
    await pool.query("commit");
    // Fichiers supprimés seulement après la validation en base.
    for (const cle of cles) {
      if (s3) await s3.send(new DeleteObjectCommand({ Bucket: s3c.bucket, Key: cle })).catch(() => undefined);
      await rm(path.join(local, cle), { force: true });
    }
    console.log(`\nSupprimés : ${aSupprimer.length} dossier(s), ${sup.length} client(s), ${cles.length} fichier(s).\n`);
  } catch (e) {
    await pool.query("rollback");
    throw e;
  }
} finally {
  await pool.end();
}
