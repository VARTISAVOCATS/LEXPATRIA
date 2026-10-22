// Applique les migrations SQL (dossier drizzle/) sur la base PostgreSQL de production.
// Lancé automatiquement au démarrage du conteneur, avant le serveur. Sans effet si tout est à jour.
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL manquant : migrations non appliquées.");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: process.env.DOSSIER_MIGRATIONS ?? new URL("../drizzle", import.meta.url).pathname });
  console.log("Migrations appliquées.");
} finally {
  await pool.end();
}
