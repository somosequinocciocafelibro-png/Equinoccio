import { businessDay } from "@/domain/day";
import type { Db } from "./db";

export interface TableInfo {
  id: string;
  name: string;
  salon: string | null;
  capacity: number | null;
  isTakeout: boolean;
  displayName: string;
}
export interface ProductInfo {
  id: string;
  name: string;
  category: string;
  price: number;
}
export interface ExtraInfo {
  id: string;
  name: string;
  delta: number;
}

export async function listTables(db: Db): Promise<TableInfo[]> {
  const rows = await db.query<{ id: string; name: string; salon: string | null; capacity: number | null; is_takeout: boolean }>(
    `select id, name, salon, capacity, is_takeout from dining_tables where active order by sort`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    salon: r.salon,
    capacity: r.capacity,
    isTakeout: r.is_takeout,
    displayName: r.salon ? `${r.salon} · ${r.name}` : r.name,
  }));
}

export async function listProducts(db: Db): Promise<ProductInfo[]> {
  return db.query<ProductInfo>(`select id, name, category, price from products where active order by sort, name`);
}

export async function listExtras(db: Db): Promise<ExtraInfo[]> {
  return db.query<ExtraInfo>(`select id, name, delta from extras where active order by delta, name`);
}

/** Nombre de cada persona que usa el sistema, por id de usuario. */
export async function listProfileNames(db: Db): Promise<Record<string, string>> {
  const rows = await db.query<{ user_id: string; name: string }>(`select user_id, name from profiles`);
  return Object.fromEntries(rows.map((r) => [r.user_id, r.name]));
}

export async function getServicePct(db: Db): Promise<number> {
  const [row] = await db.query<{ service_pct: number }>(`select service_pct from settings`);
  return row.service_pct;
}

export interface VoidedInfo {
  id: string;
  tableName: string;
  reason: string;
  at: string;
}

/** Cuentas anuladas ese día (hora de Bogotá), para la lista del cierre. */
export async function listVoidedOn(db: Db, day: string): Promise<VoidedInfo[]> {
  const rows = await db.query<{ id: string; table_name: string; salon: string | null; void_reason: string | null; voided_at: Date | string }>(
    `select id, table_name, salon, void_reason, voided_at from tickets
     where status = 'anulado' and voided_at is not null
       and voided_at >= $1::timestamptz - interval '1 day' and voided_at < $1::timestamptz + interval '2 days'
     order by voided_at`,
    [`${day}T00:00:00Z`],
  );
  return rows
    .map((r) => ({
      id: r.id,
      tableName: r.salon ? `${r.salon} · ${r.table_name}` : r.table_name,
      reason: r.void_reason ?? "",
      at: new Date(r.voided_at).toISOString(),
    }))
    .filter((r) => businessDay(r.at) === day);
}

export async function listAllProducts(db: Db): Promise<(ProductInfo & { active: boolean })[]> {
  return db.query(`select id, name, category, price, active from products order by sort, name`);
}

export async function listAllExtras(db: Db): Promise<(ExtraInfo & { active: boolean })[]> {
  return db.query(`select id, name, delta, active from extras order by delta, name`);
}

export async function listAllTables(db: Db): Promise<(TableInfo & { active: boolean })[]> {
  const rows = await db.query<{
    id: string;
    name: string;
    salon: string | null;
    capacity: number | null;
    is_takeout: boolean;
    active: boolean;
  }>(`select id, name, salon, capacity, is_takeout, active from dining_tables order by sort`);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    salon: r.salon,
    capacity: r.capacity,
    isTakeout: r.is_takeout,
    active: r.active,
    displayName: r.salon ? `${r.salon} · ${r.name}` : r.name,
  }));
}
