// Copie hors du serveur, dans le stockage objet OVHcloud (compatible S3, en France) :
//  - « base »   : la sauvegarde de la base reçue sur l'entrée standard (fichier .sql.gz), conservée 30 jours ;
//  - « pieces » : les pièces des clients encore stockées sur le serveur (copie sans doublon, les originaux restent).
// Les accès S3 sont ceux saisis au back office (Connexions › OVHcloud Object Storage), sinon ceux du fichier .env.
// Usage sur le serveur (lancé chaque nuit par deploiement/sauvegarde-base.sh) :
//   docker compose exec -T app node outils/sauvegarde-externe.mjs base lexpatria-AAAAMMJJ.sql.gz < fichier
//   docker compose exec -T app node outils/sauvegarde-externe.mjs pieces
import { createDecipheriv } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const [mode, nom] = process.argv.slice(2);
const CONSERVATION_JOURS = 30;

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

async function configuration() {
  const v = {};
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    try {
      for (const l of (await pool.query("select chiffre from connexions")).rows) Object.assign(v, dechiffrer(l.chiffre));
    } catch {
      /* base indisponible : fichier .env seul */
    } finally {
      await pool.end();
    }
  }
  const lire = (n) => v[n] || process.env[n];
  return { endpoint: lire("S3_ENDPOINT"), region: lire("S3_REGION") ?? "gra", bucket: lire("S3_BUCKET"), ak: lire("S3_ACCESS_KEY"), sk: lire("S3_SECRET_KEY") };
}

const c = await configuration();
if (!c.endpoint || !c.bucket || !c.ak || !c.sk) {
  console.log("Stockage objet non configuré (back office › Connexions) : copie externe ignorée.");
  process.exit(0);
}
const s3 = new S3Client({ region: c.region, endpoint: c.endpoint, credentials: { accessKeyId: c.ak, secretAccessKey: c.sk }, forcePathStyle: true });

if (mode === "base") {
  if (!nom || !/^lexpatria-[\w.-]+\.sql\.gz$/.test(nom)) {
    console.error("Nom de fichier attendu : lexpatria-AAAAMMJJ-HHMM.sql.gz");
    process.exit(1);
  }
  const morceaux = [];
  for await (const m of process.stdin) morceaux.push(m);
  const corps = Buffer.concat(morceaux);
  if (corps.length < 100) {
    console.error("Sauvegarde vide : rien n'est envoyé.");
    process.exit(1);
  }
  await s3.send(new PutObjectCommand({ Bucket: c.bucket, Key: `sauvegardes/base/${nom}`, Body: corps, ContentType: "application/gzip", ServerSideEncryption: "AES256" }));
  console.log(`Sauvegarde copiée dans le stockage objet : sauvegardes/base/${nom} (${Math.round(corps.length / 1024)} Ko)`);
  // Conservation : les copies de plus de 30 jours sont supprimées.
  const limite = Date.now() - CONSERVATION_JOURS * 86_400_000;
  const liste = await s3.send(new ListObjectsV2Command({ Bucket: c.bucket, Prefix: "sauvegardes/base/" }));
  for (const o of liste.Contents ?? []) if (o.LastModified && o.LastModified.getTime() < limite) await s3.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: o.Key }));
} else if (mode === "pieces") {
  const racine = process.env.STOCKAGE_LOCAL ?? path.join(process.cwd(), ".stockage");
  const fichiers = [];
  async function parcourir(d) {
    for (const e of await readdir(d, { withFileTypes: true }).catch(() => [])) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await parcourir(p);
      else fichiers.push(p);
    }
  }
  await parcourir(racine);
  let copies = 0;
  for (const p of fichiers) {
    const cle = path.relative(racine, p).split(path.sep).join("/");
    const existe = await s3.send(new HeadObjectCommand({ Bucket: c.bucket, Key: cle })).then(() => true, () => false);
    if (existe) continue;
    await s3.send(new PutObjectCommand({ Bucket: c.bucket, Key: cle, Body: await readFile(p), ServerSideEncryption: "AES256" }));
    copies++;
  }
  console.log(`Pièces : ${fichiers.length} sur le serveur, ${copies} copiée(s) dans le stockage objet.`);
} else {
  console.error("Usage : node outils/sauvegarde-externe.mjs base <nom.sql.gz>  |  pieces");
  process.exit(1);
}
