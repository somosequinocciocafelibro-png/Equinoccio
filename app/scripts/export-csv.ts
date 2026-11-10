/**
 * Respaldo manual: guarda las cuentas, líneas, pagos y cierres como archivos CSV.
 *
 *   DATABASE_URL=postgres://... npm run export -- ./respaldo-2026-11-15
 */
import { createDb } from "../src/server/db";
import { exportAll } from "../src/server/exportCsv";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable de entorno DATABASE_URL.");
  const dir = process.argv[2] ?? `respaldo-${new Date().toISOString().slice(0, 10)}`;
  const files = await exportAll(createDb(url), dir);
  console.log(`Respaldo guardado en ${dir}: ${files.join(", ")}`);
  console.log("Guarda esa carpeta fuera del repositorio: contiene las ventas reales.");
}

main()
  .then(() => process.exit(0)) // la conexión a la base queda abierta; hay que cerrar el proceso
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
