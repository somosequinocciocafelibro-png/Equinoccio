/**
 * Prepara la base de datos: aplica las migraciones que falten y carga el catálogo inicial
 * (salones, mesas, extras y productos) solo si la base está vacía. Se puede repetir sin riesgo.
 *
 *   DATABASE_URL=postgres://... npm run db:setup
 */
import { join } from "node:path";
import { createDb } from "../src/server/db";
import { setupDb } from "../src/server/setup";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable de entorno DATABASE_URL.");
  const r = await setupDb(createDb(url), { migrationsDir: join(process.cwd(), "db", "migrations") });
  console.log(r.migrated.length ? `Migraciones aplicadas: ${r.migrated.join(", ")}` : "No había migraciones nuevas.");
  console.log(r.seeded ? "Catálogo inicial cargado." : "El catálogo ya tenía datos: no se tocó.");
}

main()
  .then(() => process.exit(0)) // la conexión a la base queda abierta; hay que cerrar el proceso
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
