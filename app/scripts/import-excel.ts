/**
 * Importa el Excel histórico de ventas.
 *
 *   npm run import -- ruta/al/libro.xlsx                 simulación: solo imprime el informe
 *   npm run import -- ruta/al/libro.xlsx --apply          escribe en la base de datos
 *   npm run import -- libro.xlsx --fix 08/10/2026=08/11/2026   corrige una fecha mal escrita sin editar el Excel
 *
 * Necesita DATABASE_URL. El libro real no se sube al repositorio.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDb } from "../src/server/db";
import { importTickets, loadEquivalences, parseWorkbook } from "../src/server/importExcel";

function usage(): never {
  console.error("Uso: npm run import -- <libro.xlsx> [--apply] [--fix dd/mm/aaaa=dd/mm/aaaa]... [--equivalences ruta.csv]");
  process.exit(1);
}

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--fix" && args[args.indexOf(a) - 1] !== "--equivalences");
if (!file) usage();
const apply = args.includes("--apply");
const dateOverrides: Record<string, string> = {};
args.forEach((a, i) => {
  if (a !== "--fix") return;
  const [from, to] = (args[i + 1] ?? "").split("=");
  if (!from || !to) usage();
  dateOverrides[from] = to;
});
const eqIndex = args.indexOf("--equivalences");
const eqPath = eqIndex >= 0 ? args[eqIndex + 1] : join(process.cwd(), "import", "equivalences.csv");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta la variable de entorno DATABASE_URL.");
  process.exit(1);
}

async function main(): Promise<void> {
  const { tickets, discarded } = parseWorkbook(file as string);
  const report = await importTickets(createDb(url as string), tickets, loadEquivalences(readFileSync(eqPath, "utf8")), {
    dryRun: !apply,
    dateOverrides,
  });

  const porRazon = new Map<string, number>();
  for (const d of discarded) porRazon.set(d.reason.replace(/\(.*\)/, "").trim(), (porRazon.get(d.reason.replace(/\(.*\)/, "").trim()) ?? 0) + 1);

  console.log(apply ? "== IMPORTACIÓN APLICADA ==" : "== SIMULACIÓN (no se escribió nada; usa --apply para importar) ==");
  console.log(`Cuentas leídas: ${tickets.length}`);
  console.log(`${apply ? "Importadas" : "Se importarían"}: ${report.imported} · ya estaban: ${report.alreadyImported} · sin medio de pago: ${report.sinMedio}`);
  console.log(`No importadas: ${report.skipped.length}`);
  const porMotivo = new Map<string, string[]>();
  for (const s of report.skipped) porMotivo.set(s.reason, [...(porMotivo.get(s.reason) ?? []), `${s.key} (${s.mesa})${s.detail ? ` ${s.detail}` : ""}`]);
  for (const [motivo, items] of porMotivo) console.log(`  - ${motivo}: ${items.length}\n      ${items.join("\n      ")}`);
  if (report.unmappedProducts.length) console.log(`Productos sin equivalencia (agrégalos a import/equivalences.csv o al catálogo):\n  ${report.unmappedProducts.join("\n  ")}`);
  if (report.unknownMedios.length) console.log(`Medios de pago que el sistema no conoce (quedaron como sin_medio):\n  ${report.unknownMedios.join("\n  ")}`);
  if (report.ambiguousDates.length) console.log(`Fechas ambiguas (usa --fix para corregirlas):\n  ${report.ambiguousDates.join("\n  ")}`);
  if (porRazon.size) console.log(`Filas descartadas del libro:\n${[...porRazon].map(([r, n]) => `  ${n} × ${r}`).join("\n")}`);
}

main()
  .then(() => process.exit(0)) // la conexión a la base queda abierta; hay que cerrar el proceso
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
