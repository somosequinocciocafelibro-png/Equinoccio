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
  return db.query<ExtraInfo>(`select id, name, delta from extras where active order by name`);
}

export async function getServicePct(db: Db): Promise<number> {
  const [row] = await db.query<{ service_pct: number }>(`select service_pct from settings`);
  return row.service_pct;
}
