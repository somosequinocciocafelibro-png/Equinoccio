import { beforeAll, describe, expect, test } from "vitest";
import type { Db } from "@/server/db";
import { getServicePct, listExtras, listProducts, listTables, listVoidedOn } from "@/server/queries";
import { makeTestDb, seedTicket } from "../helpers/testDb";

let db: Db;
beforeAll(async () => {
  db = await makeTestDb();
});

describe("queries", () => {
  test("listTables devuelve las mesas activas en orden con su nombre de pantalla", async () => {
    const tables = await listTables(db);
    expect(tables).toHaveLength(13);
    expect(tables[0]).toMatchObject({ id: "luna-1", displayName: "Luna · Mesa 1", isTakeout: false });
    expect(tables[3]).toMatchObject({ id: "luna-barra", capacity: 2 });
    expect(tables[12]).toMatchObject({ id: "llevar", displayName: "Para llevar", isTakeout: true });
  });

  test("listTables omite las mesas inactivas", async () => {
    await db.query(`update dining_tables set active = false where id = 'sol-3'`);
    expect((await listTables(db)).map((t) => t.id)).not.toContain("sol-3");
    await db.query(`update dining_tables set active = true where id = 'sol-3'`);
  });

  test("listProducts devuelve solo los activos, en orden", async () => {
    expect(await listProducts(db)).toHaveLength(43);
    await db.query(`update products set active = false where id = 'latte'`);
    const after = await listProducts(db);
    expect(after).toHaveLength(42);
    expect(after[0]).toEqual({ id: "espresso", name: "Espresso", category: "Café", price: 4000 });
    await db.query(`update products set active = true where id = 'latte'`);
  });

  test("listVoidedOn devuelve las cuentas anuladas de ese día en hora de Bogotá", async () => {
    const id = await seedTicket(db, { tableId: "luna-1", status: "anulado", lines: [{ productId: "latte", qty: 1 }] });
    await db.query(`update tickets set void_reason = 'pedido equivocado', voided_at = $2::timestamptz where id = $1`, [
      id,
      "2026-11-09T04:30:00.000Z",
    ]);
    expect(await listVoidedOn(db, "2026-11-08")).toEqual([
      { id, tableName: "Luna · Mesa 1", reason: "pedido equivocado", at: "2026-11-09T04:30:00.000Z" },
    ]);
    expect(await listVoidedOn(db, "2026-11-09")).toEqual([]);
  });

  test("listExtras y getServicePct", async () => {
    expect((await listExtras(db)).map((e) => [e.name, e.delta])).toEqual([
      ["Caramelo", 0],
      ["Vainilla", 500],
    ]);
    expect(await getServicePct(db)).toBe(10);
  });
});
