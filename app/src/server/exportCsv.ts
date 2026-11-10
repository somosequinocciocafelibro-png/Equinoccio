import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { businessDay } from "@/domain/day";
import { serviceAmount, subtotal, total } from "@/domain/money";
import { loadTickets } from "./closings";
import type { Db } from "./db";

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].map((l) => `${l}\n`).join("");
}

/** Respaldo manual: escribe las cuentas, líneas, pagos y cierres como CSV en la carpeta indicada. */
export async function exportAll(db: Db, dir: string): Promise<string[]> {
  mkdirSync(dir, { recursive: true });
  const tickets = await loadTickets(db, {});
  const files: [string, string][] = [
    [
      "tickets.csv",
      toCsv(
        tickets.map((t) => ({
          id: t.id,
          day: t.closedAt ? businessDay(t.closedAt) : "",
          status: t.status,
          table: t.tableName,
          salon: t.salon,
          closed_at: t.closedAt,
          subtotal: subtotal(t),
          service: serviceAmount(t, 0),
          total: total(t, 0),
        })),
        ["id", "day", "status", "table", "salon", "closed_at", "subtotal", "service", "total"],
      ),
    ],
    [
      "ticket_lines.csv",
      toCsv(
        tickets.flatMap((t) => t.lines.map((l) => ({ ticket_id: t.id, product_id: l.productId, name: l.name, unit_price: l.unitPrice, qty: l.qty, extras: l.extras }))),
        ["ticket_id", "product_id", "name", "unit_price", "qty", "extras"],
      ),
    ],
    [
      "payments.csv",
      toCsv(
        tickets.flatMap((t) => t.payments.map((p) => ({ ticket_id: t.id, medio: p.medio, applied: p.applied, received: p.received, created_at: p.createdAt }))),
        ["ticket_id", "medio", "applied", "received", "created_at"],
      ),
    ],
    [
      "day_closings.csv",
      toCsv(await db.query(`select * from day_closings order by day`), [
        "day",
        "base",
        "sales",
        "service",
        "ticket_count",
        "note",
        "locked",
        "closed_at",
        "expected",
        "real",
        "diff",
        "reopened",
      ]),
    ],
  ];
  for (const [name, csv] of files) writeFileSync(join(dir, name), csv, "utf8");
  return files.map(([name]) => name);
}
