// Enregistre (ou met à jour) l'équipe d'avocats qui reçoit les dossiers, à partir d'un fichier JSON.
// Usage sur le serveur : docker compose run --rm app node outils/equipe.mjs /config/equipe.json
// Le fichier suit le modèle deploiement/equipe.exemple.json.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import pg from "pg";

// Même format d'identifiant que l'application (src/db/id.ts).
function createId() {
  const alpha = "abcdefghijklmnopqrstuvwxyz234567";
  const b = randomBytes(15);
  let s = "";
  for (let i = 0; i < 24; i++) s += alpha[(b[Math.floor((i * 5) / 8)] >> ((i * 5) % 8)) & 31];
  return s;
}

const fichier = process.argv[2];
if (!fichier || !process.env.DATABASE_URL) {
  console.error("Usage : node scripts/equipe.mjs equipe.json (avec DATABASE_URL)");
  process.exit(1);
}
const equipe = JSON.parse(readFileSync(fichier, "utf8"));
const roles = ["ASSOCIE", "AVOCAT", "SECRETARIAT", "CONFRERE_LOCAL"];
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  for (const m of equipe) {
    if (!m.email || m.email.includes("XXX") || !roles.includes(m.role)) {
      console.error(`Ligne ignorée (e-mail ou rôle à compléter) : ${m.prenom ?? ""} ${m.nom ?? ""}`);
      continue;
    }
    await pool.query(
      `insert into utilisateurs (id, email, prenom, nom, role) values ($5, $1, $2, $3, $4)
       on conflict (email) do update set prenom = excluded.prenom, nom = excluded.nom, role = excluded.role`,
      [m.email.toLowerCase(), m.prenom, m.nom, m.role, createId()],
    );
    console.log(`Enregistré : ${m.prenom} ${m.nom} (${m.role})`);
  }
} finally {
  await pool.end();
}
