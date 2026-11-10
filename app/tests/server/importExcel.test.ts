import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { beforeEach, describe, expect, test } from "vitest";
import { businessDay } from "@/domain/day";
import { loadTickets } from "@/server/closings";
import type { Db } from "@/server/db";
import { importTickets, loadEquivalences, parseWorkbook } from "@/server/importExcel";
import { makeTestDb } from "../helpers/testDb";

type Row = (string | number)[];
const E = (n: number) => `$${n.toLocaleString("en-US")}.00`;

/** Libro sintético con la misma forma del Excel real: encabezado por día, bloques por mesa y total con el medio al lado. */
const ROWS: Row[] = [
  ["03/11/2026", "", "", "", "", "", "", ""],
  ["", "", "Unidad", "Valor Unidad", "Valor Total", "BOLD", "Efectivo", "Bancolombia"],
  ["Mesa Sol", "Capuchino", 1, " $9,000 ", E(9000), "", "", ""],
  ["", "Palito Chocolate", 2, " $6,500 ", E(13000), "", "", ""],
  ["", "Total", "", "", E(22000), "Bold", "", ""],
  ["Mesa Luna", "Espresso", 1, " $4,000 ", E(4000), "", "", ""],
  ["", "Total", "", "", E(4000), "", "Efectivo", ""],
  ["Llevar", "Latte", 1, " $8,000 ", E(8000), "Efectivo", "", ""],
  ["", "", "", "Total", E(8000), "", "", ""],
  ["Mesa Equinoccio", "Cappuccino + vainilla", 1, " $9,500 ", E(9500), "", "", ""],
  ["", "", "", "", E(9500), "Nequi", "", ""],
  ["Mesa Luna", "Capuccino", 1, " $9,000 ", E(9000), "", "", ""],
  ["", "Total", "", "", E(9000), "", "", ""],
  ["Total ventas 03/11/2026", "", "", "", E(52500), "", "", ""],
  ["04/11/2026", "", "", "", "", "", "", ""],
  ["", "", "", "", "$0.00", "", "", ""],
  ["", "", "", "", "", "", "", ""],
  ["Mesa Sol", "Soda Rara", 1, " $5,000 ", E(5000), "", "", ""],
  ["", "Total", "", "", E(5000), "Bold", "", ""],
  ["Mesa Luna", "Latte", 2, " $8,000 ", E(16000), "", "", ""],
  ["", "Total", "", "", E(15000), "Bold", "", ""],
  ["Mesa Equinoccio", "afogato", 11000, " $6,500 ", E(17500), "soda", "", ""],
  ["", "Total", "", "", E(17500), "Bold", "", ""],
  ["Total ventas 04/11/2026", "", "", "", E(20000), "", "", ""],
  ["08/10/2026", "", "", "", "", "", "", ""],
  ["Mesa Luna", "Latte", 1, " $8,000 ", E(8000), "", "", ""],
  ["", "", "", "Total", E(8000), "Bold", "", ""],
  ["Total ventas 08/11/2026", "", "", "", E(8000), "", "", ""],
];

function libro(rows: Row[] = ROWS): string {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Hoja1");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["valor compra", "porcentaje"], ["$17.056", "40%"]]), "Sheet1");
  const path = join(mkdtempSync(join(tmpdir(), "eq-import-")), "ejemplo.xlsx");
  XLSX.writeFile(wb, path);
  return path;
}

const eq = loadEquivalences(readFileSync(new URL("../../import/equivalences.csv", import.meta.url), "utf8"));
let db: Db;
beforeEach(async () => {
  db = await makeTestDb();
});
const importar = (opts: { dryRun?: boolean; dateOverrides?: Record<string, string> } = {}) =>
  importTickets(db, parseWorkbook(libro()).tickets, eq, { dryRun: false, ...opts });

describe("parseWorkbook", () => {
  test("convierte cada bloque de mesa en una cuenta y solo lee la primera hoja", () => {
    const { tickets } = parseWorkbook(libro());
    expect(tickets).toHaveLength(9);
    expect(tickets[0]).toMatchObject({ mesaLabel: "Mesa Sol", declaredTotal: 22000, medioLabel: "Bold", headerDate: "03/11/2026" });
    expect(tickets[0].lines).toMatchObject([
      { name: "Capuchino", qty: 1, unitPrice: 9000 },
      { name: "Palito Chocolate", qty: 2, unitPrice: 6500 },
    ]);
  });

  test("reconoce el medio en la fila del total o en la de un producto, y el total con etiqueta en otra columna o sin etiqueta", () => {
    const t = parseWorkbook(libro()).tickets;
    expect(t[1]).toMatchObject({ medioLabel: "Efectivo", declaredTotal: 4000 });
    expect(t[2]).toMatchObject({ mesaLabel: "Llevar", medioLabel: "Efectivo", declaredTotal: 8000 });
    expect(t[3]).toMatchObject({ medioLabel: "Nequi", declaredTotal: 9500 });
    expect(t[4]).toMatchObject({ medioLabel: null, declaredTotal: 9000 });
  });

  test("descarta filas de $0, filas vacías y cantidades imposibles, y lo reporta", () => {
    const { discarded } = parseWorkbook(libro());
    const razones = discarded.map((d) => d.reason);
    expect(razones.some((r) => r.includes("$0"))).toBe(true);
    expect(razones.some((r) => r.includes("cantidad"))).toBe(true);
  });

  test("el encabezado de columnas no se toma como medio de pago", () => {
    const { tickets } = parseWorkbook(libro());
    expect(tickets.every((t) => t.medioLabel !== "BOLD" && t.medioLabel !== "Bancolombia")).toBe(true);
  });
});

describe("importTickets", () => {
  test("importa las cuentas cerradas con su día, líneas y pago", async () => {
    const r = await importar();
    expect(r.imported).toBe(5);
    const tickets = await loadTickets(db, { status: "cerrado" });
    expect(tickets).toHaveLength(5);
    const sol = tickets.find((t) => t.salon === "Sol")!;
    expect(sol).toMatchObject({ status: "cerrado", tableName: "Sin mesa (importado)" });
    expect(businessDay(sol.closedAt!)).toBe("2026-11-03");
    expect(sol.payments).toMatchObject([{ medio: "bold", applied: 22000 }]);
    expect(sol.service.frozenAmount).toBeNull();
  });

  test("unifica las variantes del nombre y guarda el precio con el que se vendió", async () => {
    await importar();
    const luna = (await loadTickets(db, { status: "cerrado" })).filter((t) => t.salon === "Luna");
    const capuccino = luna.find((t) => t.lines[0].name === "Capuchino" && t.lines[0].extras.length === 0 && t.payments[0].applied === 9000)!;
    expect(capuccino.lines[0]).toMatchObject({ productId: "capuchino", unitPrice: 9000, qty: 1 });
  });

  test("'Cappuccino + vainilla' queda como capuchino con el extra y el mismo total", async () => {
    await importar();
    const t = (await loadTickets(db, { status: "cerrado" })).find((x) => x.salon === "Equinoccio")!;
    expect(t.lines[0]).toMatchObject({ productId: "capuchino", unitPrice: 9000, extras: [{ id: "vainilla", name: "Vainilla", delta: 500 }] });
    expect(t.payments[0].applied).toBe(9500);
  });

  test("una venta para llevar usa la mesa Para llevar", async () => {
    await importar();
    const t = (await loadTickets(db, { status: "cerrado" })).find((x) => x.tableId === "llevar")!;
    expect(t).toMatchObject({ tableName: "Para llevar", payments: [{ medio: "efectivo", applied: 8000 }] });
  });

  test("la forma de pago vacía o desconocida queda como sin_medio y se cuenta", async () => {
    const r = await importar();
    expect(r.sinMedio).toBe(2);
    expect(r.unknownMedios).toEqual(["Nequi"]);
    const sin = (await loadTickets(db, { status: "cerrado" })).filter((t) => t.payments[0].medio === "sin_medio");
    expect(sin).toHaveLength(2);
  });

  test("un producto sin equivalencia no se importa y se lista", async () => {
    const r = await importar();
    expect(r.unmappedProducts).toEqual(["Soda Rara"]);
    expect(r.skipped.some((s) => s.reason === "PRODUCTO_SIN_EQUIVALENCIA")).toBe(true);
    const todas = await loadTickets(db, {});
    expect(todas.flatMap((t) => t.lines.map((l) => l.name))).not.toContain("Soda Rara");
  });

  test("una cuenta cuyos productos no suman el total declarado no se importa", async () => {
    const r = await importar();
    expect(r.skipped.some((s) => s.reason === "TOTAL_NO_CUADRA")).toBe(true);
  });

  test("una cuenta con una fila descartada que tenía valor no se importa", async () => {
    const r = await importar();
    expect(r.skipped.some((s) => s.reason === "FILAS_DESCARTADAS")).toBe(true);
  });

  test("las fechas ambiguas se listan y no se importan, salvo que se corrijan", async () => {
    const sin = await importar();
    expect(sin.ambiguousDates).toEqual(["08/10/2026 (el total dice 08/11/2026)"]);
    expect(sin.skipped.some((s) => s.reason === "FECHA_AMBIGUA")).toBe(true);
    const db2 = await makeTestDb();
    const con = await importTickets(db2, parseWorkbook(libro()).tickets, eq, { dryRun: false, dateOverrides: { "08/10/2026": "08/11/2026" } });
    expect(con.imported).toBe(6);
    expect(con.ambiguousDates).toEqual([]);
    const corregida = (await loadTickets(db2, { status: "cerrado" })).find((t) => businessDay(t.closedAt!) === "2026-11-08");
    expect(corregida?.payments[0].applied).toBe(8000);
  });

  test("la simulación cuenta lo que importaría sin escribir nada", async () => {
    const r = await importar({ dryRun: true });
    expect(r.imported).toBe(5);
    expect(await loadTickets(db, {})).toEqual([]);
  });

  test("volver a importar el mismo libro no duplica nada", async () => {
    await importar();
    const otra = await importar();
    expect(otra.imported).toBe(0);
    expect(otra.alreadyImported).toBe(5);
    expect(await loadTickets(db, { status: "cerrado" })).toHaveLength(5);
  });
});
