import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EXTRAS, PRODUCTS, seedCatalog, TABLES } from "../../db/seed/catalog";
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

export const sqlString = (v: string): string => `'${v.replace(/'/g, "''")}'`;

/**
 * Arma un único archivo SQL con todo lo necesario para una base nueva: las migraciones, su registro y el catálogo
 * inicial, dentro de una transacción. Sirve para pegarlo en el editor SQL de Supabase sin usar una terminal.
 * Deja la base igual que setupDb (hay una prueba que lo comprueba) y se genera con `npm run db:sql`.
 */
export function buildSetupSql(migrationsDir: string): string {
  const parts = [
    "-- Caja Equinoccio: preparación de una base nueva. Archivo generado con `npm run db:sql`; no se edita a mano.",
    "begin;",
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now());",
  ];
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    parts.push(`-- Migración ${file}`, readFileSync(join(migrationsDir, file), "utf8").trim());
    parts.push(`insert into schema_migrations (name) values (${sqlString(file)});`);
  }
  parts.push("-- Catálogo inicial: salones, mesas, extras y productos");
  let sort = 0;
  for (const m of TABLES) {
    parts.push(
      `insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values (${sqlString(m.id)}, ${sqlString(m.name)}, ${sqlString(m.salon)}, ${m.capacity ?? "null"}, false, ${++sort});`,
    );
  }
  parts.push(`insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('llevar', 'Para llevar', null, null, true, ${++sort});`);
  for (const e of EXTRAS) {
    parts.push(`insert into extras (id, name, delta) values (${sqlString(e.id)}, ${sqlString(e.name)}, ${e.delta});`);
  }
  let order = 0;
  for (const [id, name, category, price] of PRODUCTS) {
    parts.push(
      `insert into products (id, name, category, price, sort) values (${sqlString(id)}, ${sqlString(name)}, ${sqlString(category)}, ${price}, ${++order});`,
    );
  }
  parts.push("commit;");
  return `${parts.join("\n")}\n`;
}
