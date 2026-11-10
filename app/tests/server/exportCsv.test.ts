import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import type { Db } from "@/server/db";
import { exportAll, toCsv } from "@/server/exportCsv";
import { makeTestDb, seedTicket } from "../helpers/testDb";

describe("toCsv", () => {
  test("escribe el encabezado y escapa comas, comillas y saltos de línea", () => {
    const csv = toCsv(
      [{ a: "uno, dos", b: 'dice "hola"', c: "línea\nnueva", d: null, e: 5 }],
      ["a", "b", "c", "d", "e"],
    );
    expect(csv).toBe('a,b,c,d,e\n"uno, dos","dice ""hola""","línea\nnueva",,5\n');
  });

  test("sin filas deja solo el encabezado", () => {
    expect(toCsv([], ["x", "y"])).toBe("x,y\n");
  });
});

describe("exportAll", () => {
  let db: Db;
  beforeAll(async () => {
    db = await makeTestDb();
    await seedTicket(db, {
      tableId: "luna-1",
      status: "cerrado",
      closedAt: "2026-11-09T04:30:00.000Z",
      serviceFrozen: 800,
      lines: [{ productId: "latte", qty: 1 }],
      payments: [{ medio: "bold", applied: 8800 }],
    });
  });

  test("crea los cuatro archivos con las cuentas, líneas, pagos y cierres", async () => {
    const dir = mkdtempSync(join(tmpdir(), "eq-export-"));
    const files = await exportAll(db, dir);
    expect(files.sort()).toEqual(["day_closings.csv", "payments.csv", "ticket_lines.csv", "tickets.csv"]);
    const tickets = readFileSync(join(dir, "tickets.csv"), "utf8").trim().split("\n");
    expect(tickets[0]).toBe("id,day,status,table,salon,closed_at,subtotal,service,total");
    expect(tickets).toHaveLength(2);
    expect(tickets[1]).toMatch(/,2026-11-08,cerrado,Mesa 1,Luna,2026-11-09T04:30:00.000Z,8000,800,8800$/);
    expect(readFileSync(join(dir, "payments.csv"), "utf8")).toMatch(/bold,8800,8800/);
    expect(readFileSync(join(dir, "ticket_lines.csv"), "utf8")).toMatch(/latte,Latte,8000,1/);
  });
});
