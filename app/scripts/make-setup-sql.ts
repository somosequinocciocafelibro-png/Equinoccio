/**
 * Genera db/setup.sql: un solo archivo SQL con la migración y el catálogo inicial, para pegarlo en el editor SQL de
 * Supabase. Se vuelve a generar cada vez que cambie una migración o el catálogo inicial.
 *
 *   npm run db:sql
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSetupSql } from "../src/server/setup";

const sql = buildSetupSql(join(process.cwd(), "db", "migrations"));
writeFileSync(join(process.cwd(), "db", "setup.sql"), sql, "utf8");
console.log(`db/setup.sql escrito (${sql.split("\n").length} líneas).`);
