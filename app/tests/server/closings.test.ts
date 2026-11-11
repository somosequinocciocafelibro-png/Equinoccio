import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { closeDay, getClosing, isDayClosed, loadTickets, reopenDay } from "@/server/closings";
import type { Db } from "@/server/db";
import { openTicket } from "@/server/tickets";
import { makeTestDb, resetData, seedTicket } from "../helpers/testDb";

const DAY = "2026-11-08";
const user = "u1";
let db: Db;

beforeAll(async () => {
  db = await makeTestDb();
});
beforeEach(async () => {
  await resetData(db);
});

const venta = (o: { closedAt?: string; status?: "cerrado" | "anulado"; cash?: number } = {}) =>
  seedTicket(db, {
    tableId: "luna-1",
    status: o.status ?? "cerrado",
    closedAt: o.closedAt ?? "2026-11-08T20:00:00.000Z",
    lines: [{ productId: "latte", qty: 1 }],
    payments: [{ medio: "efectivo", applied: o.cash ?? 8000 }],
  });

const cerrar = (over: Partial<Parameters<typeof closeDay>[1]> = {}) =>
  closeDay(db, { day: DAY, base: 20000, real: { efectivo: 28000 }, note: "", userId: user, ...over });

describe("closeDay", () => {
  test("rechaza con OPEN_TICKETS si hay cuentas abiertas", async () => {
    await venta();
    await seedTicket(db, { tableId: "luna-2", status: "abierto" });
    await expect(cerrar()).rejects.toMatchObject({ code: "OPEN_TICKETS" });
  });

  test("propaga CASH_REQUIRED y NOTE_REQUIRED", async () => {
    await venta();
    await expect(cerrar({ real: {} })).rejects.toMatchObject({ code: "CASH_REQUIRED" });
    await expect(cerrar({ real: { efectivo: 27000 } })).rejects.toMatchObject({ code: "NOTE_REQUIRED" });
  });

  test("guarda esperado, real, diferencia, ventas y servicio", async () => {
    await venta();
    await cerrar();
    const [row] = await db.query<Record<string, unknown>>(`select * from day_closings where day = $1`, [DAY]);
    expect(row).toMatchObject({
      base: 20000,
      sales: 8000,
      service: 0,
      ticket_count: 1,
      locked: true,
      closed_by: user,
    });
    expect((row.expected as Record<string, number>).efectivo).toBe(28000);
    expect((row.real as Record<string, number | null>).efectivo).toBe(28000);
    expect((row.real as Record<string, number | null>).bold).toBeNull();
    expect((row.diff as Record<string, number | null>).efectivo).toBe(0);
  });

  test("rechaza un día mal escrito y montos que no son pesos enteros", async () => {
    await venta();
    await expect(cerrar({ day: "mañana" })).rejects.toMatchObject({ code: "INVALID_DAY" });
    await expect(cerrar({ base: -1 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(cerrar({ real: { efectivo: 1.5 } })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(reopenDay(db, { day: "mañana", reason: "x", userId: user })).rejects.toMatchObject({ code: "INVALID_DAY" });
  });

  test("no deja cerrar un día que todavía no llega", async () => {
    await expect(cerrar({ day: "2999-01-01", base: 0, real: { efectivo: 0 } })).rejects.toMatchObject({ code: "FUTURE_DAY" });
  });

  test("rechaza un segundo cierre del mismo día con ALREADY_CLOSED", async () => {
    await venta();
    await cerrar();
    await expect(cerrar()).rejects.toMatchObject({ code: "ALREADY_CLOSED" });
  });

  test("una cuenta anulada con pago parcial no entra en el esperado", async () => {
    await venta();
    await venta({ status: "anulado", cash: 3000 });
    await cerrar();
    const [row] = await db.query<{ expected: Record<string, number>; sales: number }>(
      `select expected, sales from day_closings where day = $1`,
      [DAY],
    );
    expect(row.expected.efectivo).toBe(28000);
    expect(row.sales).toBe(8000);
  });
});

describe("reopenDay e isDayClosed", () => {
  test("isDayClosed es true tras cerrar y false tras reabrir, y el registro queda", async () => {
    await venta();
    expect(await isDayClosed(db, DAY)).toBe(false);
    await cerrar();
    expect(await isDayClosed(db, DAY)).toBe(true);
    await reopenDay(db, { day: DAY, reason: "faltó registrar una venta", userId: user });
    expect(await isDayClosed(db, DAY)).toBe(false);
    const [row] = await db.query<{ reopened: { reason: string; by: string }[] }>(
      `select reopened from day_closings where day = $1`,
      [DAY],
    );
    expect(row.reopened).toHaveLength(1);
    expect(row.reopened[0]).toMatchObject({ reason: "faltó registrar una venta", by: user });
  });

  test("después de reabrir se puede volver a cerrar y se conserva el registro", async () => {
    await venta();
    await cerrar();
    await reopenDay(db, { day: DAY, reason: "corrección", userId: user });
    await cerrar();
    const [row] = await db.query<{ locked: boolean; reopened: unknown[] }>(
      `select locked, reopened from day_closings where day = $1`,
      [DAY],
    );
    expect(row.locked).toBe(true);
    expect(row.reopened).toHaveLength(1);
  });

  test("reabrir exige motivo y un día cerrado", async () => {
    await expect(reopenDay(db, { day: DAY, reason: "  ", userId: user })).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    await expect(reopenDay(db, { day: DAY, reason: "x", userId: user })).rejects.toMatchObject({ code: "NOT_CLOSED" });
  });
});

describe("getClosing", () => {
  test("devuelve null si el día no tiene cierre y el registro completo después", async () => {
    expect(await getClosing(db, DAY)).toBeNull();
    await venta();
    await cerrar({ note: "todo bien" });
    const c = await getClosing(db, DAY);
    expect(c).toMatchObject({
      day: DAY,
      base: 20000,
      sales: 8000,
      service: 0,
      ticketCount: 1,
      note: "todo bien",
      locked: true,
      reopened: [],
    });
    expect(c?.expected.efectivo).toBe(28000);
    expect(c?.real.bold).toBeNull();
    expect(typeof c?.closedAt).toBe("string");
  });

  test("después de reabrir queda desbloqueado con el motivo registrado", async () => {
    await venta();
    await cerrar();
    await reopenDay(db, { day: DAY, reason: "corrección", userId: user });
    const c = await getClosing(db, DAY);
    expect(c?.locked).toBe(false);
    expect(c?.reopened).toMatchObject([{ reason: "corrección", by: user }]);
  });
});

describe("loadTickets", () => {
  test("filtra por día de venta en hora de Bogotá", async () => {
    const id = await venta({ closedAt: "2026-11-09T04:30:00.000Z" });
    expect((await loadTickets(db, { closedDay: "2026-11-08" })).map((t) => t.id)).toEqual([id]);
    expect(await loadTickets(db, { closedDay: "2026-11-09" })).toEqual([]);
  });

  test("devuelve líneas, pagos, servicio y mesa de cada cuenta", async () => {
    const id = await seedTicket(db, {
      tableId: "sol-barra",
      status: "cerrado",
      closedAt: "2026-11-08T20:00:00.000Z",
      serviceFrozen: 800,
      lines: [{ productId: "latte", qty: 2 }],
      payments: [{ medio: "bold", applied: 16800 }],
    });
    const [t] = await loadTickets(db, { ids: [id] });
    expect(t).toMatchObject({
      id,
      tableId: "sol-barra",
      salon: "Sol",
      tableName: "Barra",
      status: "cerrado",
      closedAt: "2026-11-08T20:00:00.000Z",
      service: { enabled: true, custom: null, frozenAmount: 800 },
    });
    expect(t.lines).toMatchObject([{ productId: "latte", name: "Latte", unitPrice: 8000, qty: 2, extras: [] }]);
    expect(t.payments).toMatchObject([{ medio: "bold", applied: 16800 }]);
  });

  test("filtra por estado", async () => {
    await venta();
    await seedTicket(db, { tableId: "luna-2", status: "abierto" });
    expect(await loadTickets(db, { status: "abierto" })).toHaveLength(1);
  });
});

describe("quién abrió la cuenta", () => {
  test("loadTickets devuelve openedBy con el usuario que la abrió", async () => {
    const db = await makeTestDb();
    await db.query(`insert into profiles (user_id, role, name, username) values ('u-1', 'caja', 'Carolina Yepes', 'carolina')`);
    const id = await openTicket(db, { tableId: "luna-1", userId: "u-1" });
    const [t] = await loadTickets(db, { ids: [id] });
    expect(t.openedBy).toBe("u-1");
  });
});
