import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { seedCatalog } from "../../db/seed/catalog";
import type { Db } from "./db";

export interface SetupResult {
  migrated: string[];
  seeded: boolean;
}

/**
 * Prepara una base de datos: aplica las migraciones que falten (cada una en su propia transacción, registradas en
 * schema_migrations) y carga el catálogo inicial solo si la base no tiene productos ni mesas.
 */
export async function setupDb(db: Db, opts: { migrationsDir: string; seed?: boolean }): Promise<SetupResult> {
  await db.exec(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await db.query<{ name: string }>(`select name from schema_migrations`)).map((r) => r.name));
  const migrated: string[] = [];
  for (const file of readdirSync(opts.migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(opts.migrationsDir, file), "utf8");
    await db.tx(async (t) => {
      await t.exec(sql);
      await t.query(`insert into schema_migrations (name) values ($1)`, [file]);
    });
    migrated.push(file);
  }
  let seeded = false;
  if (opts.seed !== false) {
    const [{ n }] = await db.query<{ n: number }>(
      `select (select count(*) from products)::int + (select count(*) from dining_tables)::int as n`,
    );
    if (n === 0) {
      await seedCatalog(db);
      seeded = true;
    }
  }
  return { migrated, seeded };
}
