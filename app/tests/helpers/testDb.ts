import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { Db } from "@/server/db";
import type { PaymentMedio, TicketStatus } from "@/domain/types";
import { setupDb } from "@/server/setup";

type Q = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>; exec: (sql: string) => Promise<unknown> };

function adapt(pg: PGlite): Db {
  const wrap = (q: Q, inTx: boolean): Db => {
    const self: Db = {
      query: async <T>(sql: string, params?: unknown[]) => (await q.query(sql, params)).rows as T[],
      exec: async (sql: string) => {
        await q.exec(sql);
      },
      tx: <R>(fn: (t: Db) => Promise<R>): Promise<R> =>
        inTx ? fn(self) : pg.transaction((t) => fn(wrap(t as unknown as Q, true))),
    };
    return self;
  };
  return wrap(pg as unknown as Q, false);
}

const MIGRATIONS_DIR = fileURLToPath(new URL("../../db/migrations", import.meta.url));

/** Base en memoria con la migración aplicada y, por defecto, la semilla de catálogo. */
export async function makeTestDb(opts: { seed?: boolean } = {}): Promise<Db> {
  const db = adapt(new PGlite());
  await setupDb(db, { migrationsDir: MIGRATIONS_DIR, seed: opts.seed !== false });
  return db;
}

export interface SeedTicketSpec {
  tableId: string;
  status: TicketStatus;
  openedAt?: string;
  closedAt?: string;
  serviceFrozen?: number;
  lines?: { productId: string; qty: number; unitPrice?: number }[];
  payments?: { medio: PaymentMedio; applied: number }[];
}

/** Inserta una cuenta completa por SQL, para preparar escenarios sin pasar por las reglas del servidor. */
export async function seedTicket(db: Db, spec: SeedTicketSpec): Promise<string> {
  const id = `t-${randomUUID()}`;
  const [mesa] = await db.query<{ name: string; salon: string | null; is_takeout: boolean }>(
    `select name, salon, is_takeout from dining_tables where id = $1`,
    [spec.tableId],
  );
  await db.query(
    `insert into tickets (id, table_id, table_name, salon, is_takeout, status, opened_at, closed_at, service_frozen)
     values ($1, $2, $3, $4, $5, $6, coalesce($7::timestamptz, now()), $8::timestamptz, $9)`,
    [id, spec.tableId, mesa.name, mesa.salon, mesa.is_takeout, spec.status, spec.openedAt ?? null, spec.closedAt ?? null, spec.serviceFrozen ?? null],
  );
  for (const l of spec.lines ?? []) {
    const [p] = await db.query<{ name: string; price: number }>(`select name, price from products where id = $1`, [l.productId]);
    await db.query(
      `insert into ticket_lines (id, ticket_id, product_id, name, unit_price, qty) values ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), id, l.productId, p.name, l.unitPrice ?? p.price, l.qty],
    );
  }
  for (const p of spec.payments ?? []) {
    await db.query(
      `insert into payments (id, ticket_id, medio, received, applied, idempotency_key) values ($1, $2, $3, $4, $4, $5)`,
      [randomUUID(), id, p.medio, p.applied, randomUUID()],
    );
  }
  return id;
}

/** Vacía las tablas de movimientos para reutilizar la misma base entre pruebas (más rápido que crear una nueva). */
export async function resetData(db: Db): Promise<void> {
  await db.query(`truncate payments, ticket_lines, tickets, day_closings cascade`);
}

/** Base en memoria sin nada: ni migración ni semilla. */
export async function makeEmptyDb(): Promise<Db> {
  return adapt(new PGlite());
}
