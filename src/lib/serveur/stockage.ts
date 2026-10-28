// Stockage des pièces (cahier des charges, 14.3 et 11).
// Production : stockage objet OVHcloud (compatible S3, en France), chiffrement côté serveur.
// Développement : dossier local. Le classement SharePoint (Graph) est fait en plus au lot 5.

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { valeur } from "./connexions";

export interface FichierStocke {
  cle: string;
  nom: string;
  mime: string;
  taille: number;
  empreinte: string; // SHA-256
}

const TYPES_ACCEPTES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
export const TAILLE_MAX = 20 * 1024 * 1024;

export function typeAccepte(mime: string) {
  return TYPES_ACCEPTES.includes(mime);
}

// Paramètres lus au back office (rubrique Connexions) ou dans le .env.
async function conf() {
  const [endpoint, region, bucket, ak, sk] = await Promise.all(["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"].map(valeur));
  return { endpoint, region: region ?? "gra", bucket, ak, sk };
}

async function s3() {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const c = await conf();
  const client = new S3Client({
    region: c.region,
    endpoint: c.endpoint, // ex. https://s3.gra.io.cloud.ovh.net
    credentials: { accessKeyId: c.ak!, secretAccessKey: c.sk! },
    forcePathStyle: true,
  });
  return { client, bucket: c.bucket!, PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
}

const enS3 = async () => {
  const c = await conf();
  return !!c.endpoint && !!c.bucket;
};
const dossierLocal = () => process.env.STOCKAGE_LOCAL ?? path.join(process.cwd(), ".stockage");

export async function enregistrer(dossierRef: string, nom: string, mime: string, donnees: Buffer): Promise<FichierStocke> {
  const empreinte = createHash("sha256").update(donnees).digest("hex");
  const ext = (nom.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  const cle = `dossiers/${dossierRef}/${randomUUID()}.${ext}`;
  if (await enS3()) {
    const { client, bucket, PutObjectCommand } = await s3();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: cle,
        Body: donnees,
        ContentType: mime,
        ServerSideEncryption: "AES256",
      }),
    );
  } else {
    const chemin = path.join(dossierLocal(), cle);
    await mkdir(path.dirname(chemin), { recursive: true });
    await writeFile(chemin, donnees);
  }
  return { cle, nom: nom.slice(0, 200), mime, taille: donnees.length, empreinte };
}

export async function lire(cle: string): Promise<Buffer> {
  if (await enS3()) {
    try {
      const { client, bucket, GetObjectCommand } = await s3();
      const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: cle }));
      return Buffer.from(await r.Body!.transformToByteArray());
    } catch (e) {
      // Pièce déposée avant la configuration du stockage objet et pas encore copiée : lue sur le serveur.
      const local = await readFile(path.join(dossierLocal(), cle)).catch(() => null);
      if (local) return local;
      throw e;
    }
  }
  return readFile(path.join(dossierLocal(), cle));
}

export async function supprimer(cle: string): Promise<void> {
  if (await enS3()) {
    const { client, bucket, DeleteObjectCommand } = await s3();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: cle }));
  }
  // Copie éventuellement restée sur le serveur (pièce déposée avant la configuration du stockage objet).
  await rm(path.join(dossierLocal(), cle), { force: true });
}
