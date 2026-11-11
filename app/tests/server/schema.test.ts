import { beforeEach, describe, expect, test } from "vitest";
import type { Db } from "@/server/db";
import { makeTestDb } from "../helpers/testDb";

let db: Db;
beforeEach(async () => {
  db = await makeTestDb();
});

const ticketSql = `insert into tickets (id, table_id, table_name, is_takeout, status) values ($1, $2, 'Mesa', $3, 'abierto')`;
const lineSql = `insert into ticket_lines (id, ticket_id, product_id, name, unit_price, qty) values ($1, $2, 'latte', 'Latte', 8000, $3)`;
const paymentSql = `insert into payments (id, ticket_id, medio, received, applied, idempotency_key) values ($1, $2, $3, 1000, $4, $5)`;

describe("migración", () => {
  test("crea las tablas del esquema sobre una base vacía", async () => {
    const empty = await makeTestDb({ seed: false });
    const rows = await empty.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      "day_closings",
      "dining_tables",
      "extras",
      "payments",
      "products",
      "profiles",
      "schema_migrations",
      "settings",
      "ticket_lines",
      "tickets",
    ]);
  });
});

describe("restricciones", () => {
  test("una mesa no takeout no puede tener dos cuentas abiertas", async () => {
    await db.query(ticketSql, ["t1", "luna-1", false]);
    await expect(db.query(ticketSql, ["t2", "luna-1", false])).rejects.toThrow(/duplicate key/);
  });

  test("Para llevar permite varias cuentas abiertas", async () => {
    await db.query(ticketSql, ["t1", "llevar", true]);
    await db.query(ticketSql, ["t2", "llevar", true]);
    const rows = await db.query(`select id from tickets where table_id = 'llevar'`);
    expect(rows).toHaveLength(2);
  });

  test("una mesa libre vuelve a aceptar cuenta cuando la anterior se cierra", async () => {
    await db.query(ticketSql, ["t1", "luna-1", false]);
    await db.query(`update tickets set status = 'cerrado' where id = 't1'`);
    await db.query(ticketSql, ["t2", "luna-1", false]);
  });

  test("la idempotency_key de un pago es única", async () => {
    await db.query(ticketSql, ["t1", "luna-1", false]);
    await db.query(paymentSql, ["p1", "t1", "efectivo", 1000, "k1"]);
    await expect(db.query(paymentSql, ["p2", "t1", "efectivo", 1000, "k1"])).rejects.toThrow(/duplicate key/);
  });

  test("rechaza pagos aplicados en cero, cantidades en cero y medios desconocidos", async () => {
    await db.query(ticketSql, ["t1", "luna-1", false]);
    await expect(db.query(paymentSql, ["p1", "t1", "efectivo", 0, "k1"])).rejects.toThrow(/check constraint/);
    await expect(db.query(lineSql, ["l1", "t1", 0])).rejects.toThrow(/check constraint/);
    await expect(db.query(paymentSql, ["p2", "t1", "cheque", 1000, "k2"])).rejects.toThrow(/check constraint/);
  });

  test("acepta sin_medio para cuentas importadas", async () => {
    await db.query(ticketSql, ["t1", "luna-1", false]);
    await db.query(paymentSql, ["p1", "t1", "sin_medio", 1000, "k1"]);
  });
});

describe("semilla", () => {
  test("carga los salones, las mesas y las barras", async () => {
    const rows = await db.query<{ id: string; salon: string | null; capacity: number | null; is_takeout: boolean }>(
      `select id, salon, capacity, is_takeout from dining_tables order by sort`,
    );
    expect(rows.map((r) => r.id)).toEqual([
      "luna-1", "luna-2", "luna-3", "luna-barra",
      "eq-1", "eq-2", "eq-3", "eq-4",
      "sol-1", "sol-2", "sol-3", "sol-barra",
      "llevar",
    ]);
    expect(rows.filter((r) => r.capacity === 2).map((r) => r.id)).toEqual(["luna-barra", "sol-barra"]);
    expect(rows.filter((r) => r.is_takeout).map((r) => r.id)).toEqual(["llevar"]);
    expect(new Set(rows.map((r) => r.salon))).toEqual(new Set(["Luna", "Equinoccio", "Sol", null]));
  });

  test("carga los extras, el servicio y el catálogo", async () => {
    expect(await db.query(`select delta, count(*)::int as n from extras group by delta order by delta`)).toEqual([
      { delta: 500, n: 4 }, // miel, panela, vainilla, caramelo
      { delta: 1000, n: 6 }, // arequipe, cocoa, chocolate, leche condensada, chantillí, dulce de cereza
      { delta: 2000, n: 1 }, // leche espuma / frutos / soda (Cold Brew)
    ]);
    expect(await db.query(`select service_pct from settings`)).toEqual([{ service_pct: 10 }]);
    expect(await db.query(`select count(*)::int as n, count(*) filter (where active)::int as activos from products`)).toEqual([{ n: 68, activos: 55 }]);
    expect(await db.query(`select price from products where id = 'capuchino'`)).toEqual([{ price: 9000 }]);
    expect(await db.query(`select count(*)::int as n from products where category = 'Malteadas' and price = 10000 and active`)).toEqual([{ n: 3 }]);
  });
});
