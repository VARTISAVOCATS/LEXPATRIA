// Code de connexion de secours à l'espace cabinet, quand l'envoi d'e-mails ne fonctionne pas (clé Brevo absente ou révoquée).
// Affiché seulement dans le terminal du serveur ; valable 10 minutes, à usage unique.
// Usage sur le serveur : cd /opt/lexpatria && sudo docker compose exec app node outils/code-secours.mjs prenom.nom@exemple.fr
import { createHash, randomBytes, randomInt } from "node:crypto";
import pg from "pg";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email || !process.env.DATABASE_URL) {
  console.error("Usage : node outils/code-secours.mjs adresse@e-mail (avec DATABASE_URL)");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const { rows } = await pool.query("select id from utilisateurs where email = $1 and actif", [email]);
  if (!rows[0]) {
    console.error("Aucun membre actif de l'équipe avec cette adresse.");
    process.exit(1);
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await pool.query(
    `insert into codes_connexion (id, espace, email, utilisateur_id, empreinte, canal, expire_le)
     values ($1, 'EQUIPE', $2, $3, $4, 'SECOURS', now() + interval '10 minutes')`,
    [randomBytes(12).toString("hex"), email, rows[0].id, createHash("sha256").update(code).digest("hex")],
  );
  console.log(`Code de connexion (10 minutes) : ${code}`);
} finally {
  await pool.end();
}
