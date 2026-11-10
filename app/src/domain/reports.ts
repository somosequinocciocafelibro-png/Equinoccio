import { businessDay } from "./day";
import { lineTotal, subtotal, serviceAmount } from "./money";
import type { PaymentMedio, Ticket } from "./types";

export interface SalesReport {
  sales: number;
  service: number;
  count: number;
  avg: number;
  byMedio: Record<PaymentMedio, number>;
  byDay: { day: string; sales: number }[];
  byProduct: { productId: string; name: string; qty: number; sales: number }[];
  bySalon: { salon: string; sales: number }[];
  byTable: { table: string; sales: number }[];
}

const bySalesDesc = <T extends { sales: number }>(a: T, b: T) => b.sales - a.sales;

export function reportSales(tickets: Ticket[], range: { from: string; to: string }): SalesReport {
  const inRange = tickets.filter((t) => {
    if (t.status !== "cerrado" || t.closedAt === null) return false;
    const day = businessDay(t.closedAt);
    return day >= range.from && day <= range.to;
  });
  const byMedio: Record<PaymentMedio, number> = { efectivo: 0, transferencia: 0, bre_b: 0, bold: 0, sin_medio: 0 };
  const byDay = new Map<string, number>();
  const byProduct = new Map<string, { productId: string; name: string; qty: number; sales: number }>();
  const bySalon = new Map<string, number>();
  const byTable = new Map<string, number>();
  let sales = 0;
  let service = 0;
  for (const t of inRange) {
    const sub = subtotal(t);
    sales += sub;
    service += serviceAmount(t, 0);
    for (const p of t.payments) byMedio[p.medio] += p.applied;
    const day = businessDay(t.closedAt as string);
    byDay.set(day, (byDay.get(day) ?? 0) + sub);
    const salon = t.salon ?? "Sin salón";
    bySalon.set(salon, (bySalon.get(salon) ?? 0) + sub);
    const table = t.salon ? `${t.salon} · ${t.tableName}` : t.tableName;
    byTable.set(table, (byTable.get(table) ?? 0) + sub);
    for (const l of t.lines) {
      const row = byProduct.get(l.productId) ?? { productId: l.productId, name: l.name, qty: 0, sales: 0 };
      row.qty += l.qty;
      row.sales += lineTotal(l);
      byProduct.set(l.productId, row);
    }
  }
  return {
    sales,
    service,
    count: inRange.length,
    avg: inRange.length ? Math.round(sales / inRange.length) : 0,
    byMedio,
    byDay: [...byDay].map(([day, s]) => ({ day, sales: s })).sort((a, b) => a.day.localeCompare(b.day)),
    byProduct: [...byProduct.values()].sort(bySalesDesc),
    bySalon: [...bySalon].map(([salon, s]) => ({ salon, sales: s })).sort(bySalesDesc),
    byTable: [...byTable].map(([table, s]) => ({ table, sales: s })).sort(bySalesDesc),
  };
}
