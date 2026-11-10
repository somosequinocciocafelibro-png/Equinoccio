import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { loadTickets } from "@/server/closings";
import {
  setProductActive,
  setServicePct,
  upsertExtra,
  upsertProduct,
  upsertTable,
} from "@/server/catalog";
import type { Db } from "@/server/db";
import { getServicePct, listAllExtras, listAllProducts, listAllTables } from "@/server/queries";
import { makeTestDb, resetData, seedTicket } from "../helpers/testDb";

let db: Db;
beforeAll(async () => {
  db = await makeTestDb();
});
beforeEach(async () => {
  await resetData(db);
});

const nuevo = (o: Partial<Parameters<typeof upsertProduct>[1]> = {}) =>
  upsertProduct(db, { name: "Brownie", category: "Postres", price: 5000, active: true, ...o });

describe("productos", () => {
  test("crea un producto al final del catálogo y lo devuelve activo", async () => {
    const id = await nuevo();
    const todos = await listAllProducts(db);
    const p = todos.find((x) => x.id === id);
    expect(p).toMatchObject({ name: "Brownie", category: "Postres", price: 5000, active: true });
    expect(todos[todos.length - 1].id).toBe(id);
  });

  test("sin categoría queda en Otros", async () => {
    const id = await nuevo({ name: "Galleta", category: "  " });
    expect((await listAllProducts(db)).find((x) => x.id === id)?.category).toBe("Otros");
  });

  test("rechaza un nombre repetido sin importar mayúsculas ni tildes", async () => {
    await expect(nuevo({ name: " latte " })).rejects.toMatchObject({ code: "NAME_TAKEN" });
    await expect(nuevo({ name: "AROMATICA SANDIA" })).rejects.toMatchObject({ code: "NAME_TAKEN" });
  });

  test("un producto puede conservar su propio nombre al editarse", async () => {
    const id = await nuevo({ name: "Tiramisú" });
    await upsertProduct(db, { id, name: "Tiramisú", category: "Postres", price: 7000, active: true });
    expect((await listAllProducts(db)).find((x) => x.id === id)?.price).toBe(7000);
  });

  test("rechaza nombre vacío, precio no entero o negativo y producto inexistente", async () => {
    await expect(nuevo({ name: " " })).rejects.toMatchObject({ code: "NAME_REQUIRED" });
    await expect(nuevo({ name: "A", price: 10.5 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(nuevo({ name: "B", price: -1 })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    await expect(
      upsertProduct(db, { id: "no-existe", name: "C", category: "x", price: 1, active: true }),
    ).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
  });

  test("desactivar un producto lo conserva y no cambia las cuentas pasadas", async () => {
    const id = await nuevo({ name: "Temporal" });
    const t = await seedTicket(db, {
      tableId: "luna-1",
      status: "cerrado",
      closedAt: "2026-11-08T20:00:00.000Z",
      lines: [{ productId: id, qty: 2 }],
      payments: [{ medio: "efectivo", applied: 10000 }],
    });
    await setProductActive(db, id, false);
    const p = (await listAllProducts(db)).find((x) => x.id === id);
    expect(p).toMatchObject({ active: false, name: "Temporal" });
    const [ticket] = await loadTickets(db, { ids: [t] });
    expect(ticket.lines[0]).toMatchObject({ productId: id, name: "Temporal", unitPrice: 5000, qty: 2 });
  });

  test("editar el precio no cambia el unit_price de las líneas existentes", async () => {
    const t = await seedTicket(db, {
      tableId: "luna-1",
      status: "cerrado",
      closedAt: "2026-11-08T20:00:00.000Z",
      lines: [{ productId: "latte", qty: 1 }],
      payments: [{ medio: "efectivo", applied: 8000 }],
    });
    await upsertProduct(db, { id: "latte", name: "Latte", category: "Café", price: 9000, active: true });
    expect((await loadTickets(db, { ids: [t] }))[0].lines[0].unitPrice).toBe(8000);
    await upsertProduct(db, { id: "latte", name: "Latte", category: "Café", price: 8000, active: true });
  });
});

describe("extras", () => {
  test("crea, edita y desactiva un extra", async () => {
    const id = await upsertExtra(db, { name: "Canela", delta: 300, active: true });
    await upsertExtra(db, { id, name: "Canela", delta: 400, active: false });
    expect((await listAllExtras(db)).find((e) => e.id === id)).toEqual({ id, name: "Canela", delta: 400, active: false });
  });

  test("rechaza nombre vacío y diferencia que no sea entera", async () => {
    await expect(upsertExtra(db, { name: "", delta: 0, active: true })).rejects.toMatchObject({ code: "NAME_REQUIRED" });
    await expect(upsertExtra(db, { name: "X", delta: 1.5, active: true })).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
  });
});

describe("mesas", () => {
  test("crea una mesa con salón y capacidad", async () => {
    const id = await upsertTable(db, { name: "Mesa 5", salon: "Luna", capacity: 4, active: true });
    expect((await listAllTables(db)).find((t) => t.id === id)).toMatchObject({
      name: "Mesa 5",
      salon: "Luna",
      capacity: 4,
      active: true,
      isTakeout: false,
    });
  });

  test("rechaza nombre vacío y capacidad inválida", async () => {
    await expect(upsertTable(db, { name: " ", salon: null, capacity: null, active: true })).rejects.toMatchObject({ code: "NAME_REQUIRED" });
    await expect(upsertTable(db, { name: "M", salon: null, capacity: 0, active: true })).rejects.toMatchObject({ code: "INVALID_CAPACITY" });
  });

  test("no deja desactivar una mesa con cuenta abierta", async () => {
    await seedTicket(db, { tableId: "sol-3", status: "abierto" });
    const mesa = { id: "sol-3", name: "Mesa 3", salon: "Sol", capacity: null };
    await expect(upsertTable(db, { ...mesa, active: false })).rejects.toMatchObject({ code: "TABLE_IN_USE" });
    await db.query(`update tickets set status = 'cerrado' where table_id = 'sol-3'`);
    await upsertTable(db, { ...mesa, active: false });
    await upsertTable(db, { ...mesa, active: true });
  });
});

describe("servicio", () => {
  test("acepta de 0 a 30 y rechaza lo demás", async () => {
    await setServicePct(db, 0);
    expect(await getServicePct(db)).toBe(0);
    await setServicePct(db, 30);
    expect(await getServicePct(db)).toBe(30);
    await expect(setServicePct(db, 31)).rejects.toMatchObject({ code: "INVALID_PCT" });
    await expect(setServicePct(db, -1)).rejects.toMatchObject({ code: "INVALID_PCT" });
    await expect(setServicePct(db, 10.5)).rejects.toMatchObject({ code: "INVALID_PCT" });
    await setServicePct(db, 10);
  });
});
