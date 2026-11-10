/**
 * Pruebas contra un Postgres real (el mismo driver que usa la app). Se saltan si no hay TEST_DATABASE_URL.
 * La base debe llamarse con "test" (se vacía al empezar):
 *   TEST_DATABASE_URL=postgres://usuario@127.0.0.1:5432/caja_test npm test
 * Existen porque la base en memoria de las demás pruebas (PGlite) no se comporta igual en dos cosas: los parámetros
 * jsonb y la concurrencia real entre conexiones.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { fileURLToPath } from "node:url";
import { closeDay, getClosing, loadTickets, reopenDay } from "@/server/closings";
import { createDb, type Db } from "@/server/db";
import { importTickets, loadEquivalences } from "@/server/importExcel";
import { setupDb } from "@/server/setup";
import { addLine, addPayment, openTicket, toggleExtra } from "@/server/tickets";
import { readFileSync } from "node:fs";

const url = process.env.TEST_DATABASE_URL;
const migrationsDir = fileURLToPath(new URL("../../db/migrations", import.meta.url));
const eq = loadEquivalences(readFileSync(new URL("../../import/equivalences.csv", import.meta.url), "utf8"));
const user = "u-test";

describe.skipIf(!url)("contra Postgres real", () => {
  let db: Db;
  beforeAll(async () => {
    if (!/test/i.test(new URL(url as string).pathname)) throw new Error("TEST_DATABASE_URL debe apuntar a una base cuyo nombre incluya 'test'");
    db = createDb(url as string);
    await setupDb(db, { migrationsDir });
    await db.query(`truncate payments, ticket_lines, tickets, day_closings cascade`);
  });
  afterAll(async () => {
    await db.query(`truncate payments, ticket_lines, tickets, day_closings cascade`);
  });

  const tipo = async (sql: string, params: unknown[] = []) => (await db.query<{ t: string }>(sql, params))[0].t;

  test("el extra de una línea se guarda como lista, no como texto", async () => {
    const t = await openTicket(db, { tableId: "luna-1", userId: user });
    await addLine(db, { ticketId: t, productId: "latte", qty: 1 });
    const [l] = (await loadTickets(db, { ids: [t] }))[0].lines;
    await toggleExtra(db, { lineId: l.id, extraId: "vainilla" });
    expect(await tipo(`select jsonb_typeof(extras) as t from ticket_lines where id = $1`, [l.id])).toBe("array");
    expect((await loadTickets(db, { ids: [t] }))[0].lines[0].extras).toEqual([{ id: "vainilla", name: "Vainilla", delta: 500 }]);
  });

  test("el cierre del día guarda objetos y la reapertura guarda una lista", async () => {
    await db.query(`truncate payments, ticket_lines, tickets, day_closings cascade`);
    await closeDay(db, { day: "2026-01-05", base: 5000, real: { efectivo: 5000 }, note: "", userId: user });
    expect(await tipo(`select jsonb_typeof(expected) as t from day_closings where day = '2026-01-05'`)).toBe("object");
    expect(await tipo(`select jsonb_typeof(real) as t from day_closings where day = '2026-01-05'`)).toBe("object");
    const c = await getClosing(db, "2026-01-05");
    expect(c?.expected.efectivo).toBe(5000);
    expect(c?.real.bold).toBeNull();
    await reopenDay(db, { day: "2026-01-05", reason: "corrección", userId: user });
    expect(await tipo(`select jsonb_typeof(reopened) as t from day_closings where day = '2026-01-05'`)).toBe("array");
    expect((await getClosing(db, "2026-01-05"))?.reopened).toMatchObject([{ reason: "corrección", by: user }]);
    await reopenDay(db, { day: "2026-01-05", reason: "x", userId: user }).catch(() => undefined);
  });

  test("la importación guarda el extra como lista", async () => {
    const r = await importTickets(
      db,
      [{ key: "imp-20261103-1", headerDate: "03/11/2026", declaredDate: null, mesaLabel: "Mesa Sol", lines: [{ name: "Cappuccino + vainilla", qty: 1, unitPrice: 9500, row: 3 }], declaredTotal: 9500, medioLabel: "Bold", firstRow: 3, dirty: false, duplicateDate: false, declaredDayTotal: null, dayId: "03/11/2026#1" }],
      eq,
      { dryRun: false },
    );
    expect(r.imported).toBe(1);
    expect(await tipo(`select jsonb_typeof(extras) as t from ticket_lines where ticket_id = 'imp-20261103-1'`)).toBe("array");
    expect((await loadTickets(db, { ids: ["imp-20261103-1"] }))[0].lines[0].extras).toMatchObject([{ id: "vainilla" }]);
  });

  test("20 toques simultáneos del mismo producto suman 20 en una línea", async () => {
    const t = await openTicket(db, { tableId: "luna-2", userId: user });
    const rs = await Promise.allSettled(Array.from({ length: 20 }, () => addLine(db, { ticketId: t, productId: "latte", qty: 1 })));
    expect(rs.every((r) => r.status === "fulfilled")).toBe(true);
    const lines = (await loadTickets(db, { ids: [t] }))[0].lines;
    expect(lines.reduce((s, l) => s + l.qty, 0)).toBe(20);
  });

  test("10 envíos del mismo pago dejan un solo pago", async () => {
    const t = await openTicket(db, { tableId: "luna-3", userId: user });
    await addLine(db, { ticketId: t, productId: "latte", qty: 1 });
    const rs = await Promise.allSettled(
      Array.from({ length: 10 }, () => addPayment(db, { ticketId: t, medio: "bold", amount: 3000, received: null, idempotencyKey: "misma", userId: user })),
    );
    expect(rs.every((r) => r.status === "fulfilled")).toBe(true);
    expect((await loadTickets(db, { ids: [t] }))[0].payments).toHaveLength(1);
  });

  test("tres pagos que no caben a la vez nunca cobran de más", async () => {
    const t = await openTicket(db, { tableId: "sol-1", userId: user });
    await addLine(db, { ticketId: t, productId: "latte", qty: 1 }); // total 8.800 con servicio
    await Promise.allSettled(
      ["a", "b", "c"].map((k) => addPayment(db, { ticketId: t, medio: "efectivo", amount: 5800, received: null, idempotencyKey: k, userId: user })),
    );
    const ticket = (await loadTickets(db, { ids: [t] }))[0];
    expect(ticket.payments.reduce((s, p) => s + p.applied, 0)).toBeLessThanOrEqual(8800);
  });

  test("10 aperturas simultáneas de una mesa dan una sola cuenta", async () => {
    const ids = await Promise.all(Array.from({ length: 10 }, () => openTicket(db, { tableId: "sol-2", userId: user })));
    expect(new Set(ids).size).toBe(1);
  });
});
