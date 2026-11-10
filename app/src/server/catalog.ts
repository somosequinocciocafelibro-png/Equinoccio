import { randomUUID } from "node:crypto";
import { normalize } from "@/lib/parseSearch";
import type { Db } from "./db";
import { AppError } from "./errors";

function slug(name: string): string {
  return normalize(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}
const newId = (name: string) => `${slug(name)}-${randomUUID().slice(0, 6)}`;
const isPesos = (n: number) => Number.isInteger(n) && n >= 0;

export interface ProductInput {
  id?: string;
  name: string;
  category: string;
  price: number;
  active: boolean;
}

/** Crea o edita un producto. No existe borrado: un producto se desactiva y conserva su historial. */
export async function upsertProduct(db: Db, p: ProductInput): Promise<string> {
  const name = p.name.trim();
  if (!name) throw new AppError("NAME_REQUIRED");
  if (!isPesos(p.price)) throw new AppError("INVALID_AMOUNT");
  const category = p.category.trim() || "Otros";
  return db.tx(async (t) => {
    const all = await t.query<{ id: string; name: string }>(`select id, name from products`);
    if (all.some((x) => x.id !== p.id && normalize(x.name) === normalize(name))) throw new AppError("NAME_TAKEN");
    if (p.id) {
      const rows = await t.query(
        `update products set name = $2, category = $3, price = $4, active = $5 where id = $1 returning id`,
        [p.id, name, category, p.price, p.active],
      );
      if (rows.length === 0) throw new AppError("PRODUCT_NOT_FOUND");
      return p.id;
    }
    const id = newId(name);
    await t.query(
      `insert into products (id, name, category, price, active, sort)
       values ($1, $2, $3, $4, $5, (select coalesce(max(sort), 0) + 1 from products))`,
      [id, name, category, p.price, p.active],
    );
    return id;
  });
}

export async function setProductActive(db: Db, id: string, active: boolean): Promise<void> {
  const rows = await db.query(`update products set active = $2 where id = $1 returning id`, [id, active]);
  if (rows.length === 0) throw new AppError("PRODUCT_NOT_FOUND");
}

export interface ExtraInput {
  id?: string;
  name: string;
  delta: number;
  active: boolean;
}

export async function upsertExtra(db: Db, e: ExtraInput): Promise<string> {
  const name = e.name.trim();
  if (!name) throw new AppError("NAME_REQUIRED");
  if (!Number.isInteger(e.delta)) throw new AppError("INVALID_AMOUNT");
  if (e.id) {
    const rows = await db.query(`update extras set name = $2, delta = $3, active = $4 where id = $1 returning id`, [
      e.id,
      name,
      e.delta,
      e.active,
    ]);
    if (rows.length === 0) throw new AppError("EXTRA_NOT_FOUND");
    return e.id;
  }
  const id = newId(name);
  await db.query(`insert into extras (id, name, delta, active) values ($1, $2, $3, $4)`, [id, name, e.delta, e.active]);
  return id;
}

export interface TableInput {
  id?: string;
  name: string;
  salon: string | null;
  capacity: number | null;
  active: boolean;
}

export async function upsertTable(db: Db, t: TableInput): Promise<string> {
  const name = t.name.trim();
  if (!name) throw new AppError("NAME_REQUIRED");
  if (t.capacity !== null && (!Number.isInteger(t.capacity) || t.capacity < 1)) throw new AppError("INVALID_CAPACITY");
  const salon = t.salon?.trim() ? t.salon.trim() : null;
  return db.tx(async (q) => {
    if (t.id) {
      if (!t.active) {
        const open = await q.query(`select 1 from tickets where table_id = $1 and status = 'abierto' limit 1`, [t.id]);
        if (open.length) throw new AppError("TABLE_IN_USE");
      }
      const rows = await q.query(
        `update dining_tables set name = $2, salon = $3, capacity = $4, active = $5 where id = $1 returning id`,
        [t.id, name, salon, t.capacity, t.active],
      );
      if (rows.length === 0) throw new AppError("TABLE_NOT_FOUND");
      return t.id;
    }
    const id = newId(`${salon ?? ""} ${name}`);
    await q.query(
      `insert into dining_tables (id, name, salon, capacity, active, is_takeout, sort)
       values ($1, $2, $3, $4, $5, false, (select coalesce(max(sort), 0) + 1 from dining_tables))`,
      [id, name, salon, t.capacity, t.active],
    );
    return id;
  });
}

export async function setServicePct(db: Db, pct: number): Promise<void> {
  if (!Number.isInteger(pct) || pct < 0 || pct > 30) throw new AppError("INVALID_PCT");
  await db.query(`update settings set service_pct = $1`, [pct]);
}
