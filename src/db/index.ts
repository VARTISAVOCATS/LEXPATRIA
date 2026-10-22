// Connexion à la base. En production : PostgreSQL (OVHcloud) via DATABASE_URL.
// Sans DATABASE_URL (développement, tests) : PGlite, PostgreSQL embarqué en mémoire.

import { sql } from "drizzle-orm";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Base = NodePgDatabase<typeof schema>;

let base: Promise<Base> | undefined;

export function db(): Promise<Base> {
  if (!base) base = ouvrir();
  return base;
}

async function ouvrir(): Promise<Base> {
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    return drizzlePg(new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }), { schema });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: "drizzle" });
  // Développement : l'équipe de démonstration (adresses fictives), pour tester l'attribution.
  await d.insert(schema.utilisateurs).values([
    { email: "rafik.rabia@exemple.invalid", prenom: "Rafik", nom: "Rabia", role: "ASSOCIE" },
    { email: "ahlem.benabderrazak@exemple.invalid", prenom: "Ahlem", nom: "Ben Abderrazak", role: "ASSOCIE" },
    { email: "boualem.kachi@exemple.invalid", prenom: "Boualem", nom: "Kachi", role: "AVOCAT" },
    { email: "mohamed.khamlichi@exemple.invalid", prenom: "Mohamed", nom: "Khamlichi", role: "AVOCAT" },
  ]);
  return d as unknown as Base;
}

export async function prochainCodeClient(d: Base): Promise<string> {
  const r = await d.execute(sql`select nextval('seq_client') as n`);
  return "C" + String((r.rows[0] as { n: string }).n);
}

export async function prochaineReference(d: Base): Promise<string> {
  const r = await d.execute(sql`select nextval('seq_dossier') as n`);
  return "D" + String((r.rows[0] as { n: string }).n);
}

export { schema };
