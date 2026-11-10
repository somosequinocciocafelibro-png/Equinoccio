import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { businessDay } from "@/domain/day";
import { loadTickets } from "@/server/closings";
import type { Db } from "@/server/db";
import {
  addLine,
  addPayment,
  openTicket,
  removePayment,
  setLineQty,
  setService,
  toggleExtra,
  voidTicket,
} from "@/server/tickets";
import { makeTestDb, resetData, seedTicket } from "../helpers/testDb";

const userId = "u1";
let db: Db;

beforeAll(async () => {
  db = await makeTestDb();
});
beforeEach(async () => {
  await resetData(db);
  await db.query(`update settings set service_pct = 10`);
  await db.query(`update products set price = 8000, active = true where id = 'latte'`);
});

const abrir = (tableId = "luna-1") => openTicket(db, { tableId, userId });
const leer = async (id: string) => (await loadTickets(db, { ids: [id] }))[0];
const conLatte = async (qty = 1) => {
  const id = await abrir();
  await addLine(db, { ticketId: id, productId: "latte", qty });
  return id;
};
let key = 0;
const pagar = (ticketId: string, o: Partial<Parameters<typeof addPayment>[1]> = {}) =>
  addPayment(db, { ticketId, medio: "efectivo", amount: null, received: null, idempotencyKey: `k${++key}`, userId, ...o });
const cerrarHoy = () =>
  db.query(
    `insert into day_closings (day, base, expected, real, diff, sales, service, ticket_count, locked)
     values ($1, 0, '{}', '{}', '{}', 0, 0, 0, true)`,
    [businessDay(new Date().toISOString())],
  );

describe("openTicket", () => {
  test("devuelve la misma cuenta para la misma mesa y una nueva en cada venta para llevar", async () => {
    expect(await abrir("luna-1")).toBe(await abrir("luna-1"));
    expect(await abrir("llevar")).not.toBe(await abrir("llevar"));
  });

  test("rechaza una mesa que no existe", async () => {
    await expect(abrir("no-existe")).rejects.toMatchObject({ code: "TABLE_NOT_FOUND" });
  });

  test("no abre cuentas si el día de hoy ya está cerrado", async () => {
    await cerrarHoy();
    await expect(abrir()).rejects.toMatchObject({ code: "DAY_CLOSED" });
  });
});

describe("líneas", () => {
  test("suma la cantidad en la misma línea y guarda el precio del momento", async () => {
    const id = await conLatte();
    await addLine(db, { ticketId: id, productId: "latte", qty: 1 });
    const t = await leer(id);
    expect(t.lines).toHaveLength(1);
    expect(t.lines[0]).toMatchObject({ qty: 2, unitPrice: 8000, name: "Latte" });
  });

  test("cambiar el precio del producto no altera la línea existente", async () => {
    const id = await conLatte();
    await db.query(`update products set price = 9000 where id = 'latte'`);
    await addLine(db, { ticketId: id, productId: "latte", qty: 1 });
    const t = await leer(id);
    expect(t.lines.map((l) => [l.unitPrice, l.qty]).sort()).toEqual([
      [8000, 1],
      [9000, 1],
    ]);
  });

  test("dos sesiones que agregan productos a la misma cuenta no pierden líneas", async () => {
    const id = await abrir();
    await Promise.all([
      addLine(db, { ticketId: id, productId: "latte", qty: 1 }),
      addLine(db, { ticketId: id, productId: "espresso", qty: 2 }),
      addLine(db, { ticketId: id, productId: "crookie", qty: 1 }),
    ]);
    const t = await leer(id);
    expect(t.lines.map((l) => l.productId).sort()).toEqual(["crookie", "espresso", "latte"]);
  });

  test("rechaza productos inexistentes o inactivos y cantidades inválidas", async () => {
    const id = await abrir();
    await db.query(`update products set active = false where id = 'latte'`);
    await expect(addLine(db, { ticketId: id, productId: "latte", qty: 1 })).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
    await expect(addLine(db, { ticketId: id, productId: "espresso", qty: 0 })).rejects.toMatchObject({ code: "INVALID_QTY" });
  });

  test("toggleExtra agrega y quita el extra con su precio", async () => {
    const id = await conLatte();
    const lineId = (await leer(id)).lines[0].id;
    await toggleExtra(db, { lineId, extraId: "vainilla" });
    expect((await leer(id)).lines[0].extras).toEqual([{ id: "vainilla", name: "Vainilla", delta: 500 }]);
    await toggleExtra(db, { lineId, extraId: "vainilla" });
    expect((await leer(id)).lines[0].extras).toEqual([]);
  });

  test("setLineQty en 0 elimina la línea", async () => {
    const id = await conLatte(2);
    const lineId = (await leer(id)).lines[0].id;
    await setLineQty(db, { lineId, qty: 5 });
    expect((await leer(id)).lines[0].qty).toBe(5);
    await setLineQty(db, { lineId, qty: 0 });
    expect((await leer(id)).lines).toEqual([]);
  });
});

describe("pagos", () => {
  test("cobrar con la misma idempotencyKey no duplica el pago ni cambia el saldo", async () => {
    const id = await conLatte();
    const a = await pagar(id, { amount: 3000, idempotencyKey: "igual" });
    const b = await pagar(id, { amount: 3000, idempotencyKey: "igual" });
    expect(b.paymentId).toBe(a.paymentId);
    const t = await leer(id);
    expect(t.payments).toHaveLength(1);
    expect(t.payments[0].applied).toBe(3000);
    expect(t.status).toBe("abierto");
  });

  test("congela el servicio en el primer pago y cierra la cuenta al llegar a cero con su cambio", async () => {
    const id = await conLatte();
    const r = await pagar(id, { received: 10000 });
    expect(r).toMatchObject({ change: 1200, closed: true });
    const t = await leer(id);
    expect(t.status).toBe("cerrado");
    expect(t.closedAt).not.toBeNull();
    expect(t.service.frozenAmount).toBe(800);
    expect(t.payments[0]).toMatchObject({ applied: 8800, received: 10000 });
  });

  test("un pago parcial deja la cuenta abierta y quitarlo libera el servicio congelado", async () => {
    const id = await conLatte();
    const r = await pagar(id, { medio: "bold", amount: 5000 });
    expect(r.closed).toBe(false);
    expect((await leer(id)).service.frozenAmount).toBe(800);
    await removePayment(db, { paymentId: r.paymentId });
    const t = await leer(id);
    expect(t.payments).toEqual([]);
    expect(t.service.frozenAmount).toBeNull();
  });

  test("usa el porcentaje de servicio de los ajustes", async () => {
    await db.query(`update settings set service_pct = 20`);
    const id = await conLatte();
    await pagar(id, { amount: 1000 });
    expect((await leer(id)).service.frozenAmount).toBe(1600);
  });

  test("setService no se puede cambiar después del primer pago", async () => {
    const id = await conLatte();
    await setService(db, { ticketId: id, enabled: false, custom: null });
    expect((await leer(id)).service.enabled).toBe(false);
    await setService(db, { ticketId: id, enabled: true, custom: 500 });
    await pagar(id, { amount: 1000 });
    await expect(setService(db, { ticketId: id, enabled: false, custom: null })).rejects.toMatchObject({ code: "SERVICE_LOCKED" });
  });

  test("rechaza cuenta vacía, monto mayor al saldo y día cerrado", async () => {
    const vacia = await abrir("luna-2");
    await expect(pagar(vacia, { amount: 1000 })).rejects.toMatchObject({ code: "EMPTY_TICKET" });
    const id = await conLatte();
    await expect(pagar(id, { amount: 99999 })).rejects.toMatchObject({ code: "EXCEEDS_BALANCE" });
    await cerrarHoy();
    await expect(pagar(id, { amount: 1000 })).rejects.toMatchObject({ code: "DAY_CLOSED" });
  });

  test("removePayment solo funciona en cuentas abiertas", async () => {
    const id = await conLatte();
    const r = await pagar(id);
    await expect(removePayment(db, { paymentId: r.paymentId })).rejects.toMatchObject({ code: "TICKET_NOT_OPEN" });
  });
});

describe("voidTicket", () => {
  test("exige motivo, guarda quién y cuándo, y los pagos dejan de contar", async () => {
    const id = await conLatte();
    await pagar(id, { amount: 3000 });
    await expect(voidTicket(db, { ticketId: id, reason: " ", userId })).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    await voidTicket(db, { ticketId: id, reason: "pedido equivocado", userId });
    const [row] = await db.query<{ status: string; void_reason: string; voided_by: string; voided_at: unknown }>(
      `select status, void_reason, voided_by, voided_at from tickets where id = $1`,
      [id],
    );
    expect(row).toMatchObject({ status: "anulado", void_reason: "pedido equivocado", voided_by: userId });
    expect(row.voided_at).not.toBeNull();
    expect(await loadTickets(db, { status: "cerrado" })).toEqual([]);
  });

  test("no deja anular una cuenta cerrada de un día ya cerrado", async () => {
    const id = await seedTicket(db, {
      tableId: "luna-3",
      status: "cerrado",
      closedAt: "2026-11-08T20:00:00.000Z",
      lines: [{ productId: "latte", qty: 1 }],
      payments: [{ medio: "efectivo", applied: 8000 }],
    });
    await db.query(
      `insert into day_closings (day, base, expected, real, diff, sales, service, ticket_count, locked)
       values ('2026-11-08', 0, '{}', '{}', '{}', 0, 0, 0, true)`,
    );
    await expect(voidTicket(db, { ticketId: id, reason: "error", userId })).rejects.toMatchObject({ code: "DAY_CLOSED" });
  });

  test("una cuenta anulada ya no admite líneas ni pagos", async () => {
    const id = await conLatte();
    await voidTicket(db, { ticketId: id, reason: "error", userId });
    await expect(addLine(db, { ticketId: id, productId: "latte", qty: 1 })).rejects.toMatchObject({ code: "TICKET_NOT_OPEN" });
    await expect(pagar(id)).rejects.toMatchObject({ code: "TICKET_NOT_OPEN" });
  });
});
