import { computeClosing } from "@/domain/cierre";
import { businessDay } from "@/domain/day";
import type { Extra, Medio, Payment, PaymentMedio, Ticket, TicketStatus } from "@/domain/types";
import { MEDIOS } from "@/domain/types";
import type { Db } from "./db";
import { AppError } from "./errors";

export interface TicketFilter {
  ids?: string[];
  status?: TicketStatus;
  closedDay?: string;
  from?: string;
  to?: string;
}

type TicketRow = {
  id: string;
  table_id: string;
  table_name: string;
  salon: string | null;
  status: TicketStatus;
  opened_at: Date | string;
  closed_at: Date | string | null;
  service_enabled: boolean;
  service_custom: number | null;
  service_frozen: number | null;
  void_reason: string | null;
};
type LineRow = {
  id: string;
  ticket_id: string;
  product_id: string;
  name: string;
  unit_price: number;
  qty: number;
  extras: Extra[];
};
type PaymentRow = {
  id: string;
  ticket_id: string;
  medio: PaymentMedio;
  received: number;
  applied: number;
  created_at: Date | string;
};

const iso = (d: Date | string) => new Date(d).toISOString();

/** Carga cuentas con sus líneas y pagos. El filtro por día usa businessDay para no duplicar la regla de Bogotá en SQL. */
export async function loadTickets(db: Db, f: TicketFilter = {}): Promise<Ticket[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.ids) {
    if (f.ids.length === 0) return [];
    where.push(`id in (${f.ids.map(p).join(", ")})`);
  }
  if (f.status) where.push(`status = ${p(f.status)}`);
  const lo = f.closedDay ?? f.from;
  const hi = f.closedDay ?? f.to;
  if (lo || hi) where.push("closed_at is not null");
  if (lo) where.push(`closed_at >= ${p(`${lo}T00:00:00Z`)}::timestamptz - interval '1 day'`);
  if (hi) where.push(`closed_at < ${p(`${hi}T00:00:00Z`)}::timestamptz + interval '2 days'`);
  const rows = await db.query<TicketRow>(
    `select * from tickets ${where.length ? `where ${where.join(" and ")}` : ""} order by opened_at, id`,
    params,
  );
  const kept = rows.filter((r) => {
    if (!lo && !hi) return true;
    const day = businessDay(iso(r.closed_at as Date | string));
    return (!lo || day >= lo) && (!hi || day <= hi);
  });
  if (kept.length === 0) return [];
  const marks = kept.map((_, i) => `$${i + 1}`).join(", ");
  const ids = kept.map((r) => r.id);
  const lines = await db.query<LineRow>(
    `select * from ticket_lines where ticket_id in (${marks}) order by created_at, id`,
    ids,
  );
  const pays = await db.query<PaymentRow>(
    `select * from payments where ticket_id in (${marks}) order by created_at, id`,
    ids,
  );
  return kept.map((r) => ({
    id: r.id,
    tableId: r.table_id,
    salon: r.salon,
    tableName: r.table_name,
    status: r.status,
    openedAt: iso(r.opened_at),
    closedAt: r.closed_at ? iso(r.closed_at) : null,
    lines: lines
      .filter((l) => l.ticket_id === r.id)
      .map((l) => ({
        id: l.id,
        productId: l.product_id,
        name: l.name,
        unitPrice: l.unit_price,
        qty: l.qty,
        extras: l.extras,
      })),
    payments: pays
      .filter((x) => x.ticket_id === r.id)
      .map(
        (x): Payment => ({
          id: x.id,
          medio: x.medio,
          received: x.received,
          applied: x.applied,
          createdAt: iso(x.created_at),
        }),
      ),
    service: { enabled: r.service_enabled, custom: r.service_custom, frozenAmount: r.service_frozen },
    voidReason: r.void_reason,
  }));
}

export async function isDayClosed(db: Db, day: string): Promise<boolean> {
  const [row] = await db.query<{ locked: boolean }>(`select locked from day_closings where day = $1`, [day]);
  return row?.locked === true;
}

export async function closeDay(
  db: Db,
  a: { day: string; base: number; real: Partial<Record<Medio, number | null>>; note: string; userId: string },
): Promise<void> {
  await db.tx(async (t) => {
    const [existing] = await t.query<{ locked: boolean; reopened: unknown[] }>(
      `select locked, reopened from day_closings where day = $1 for update`,
      [a.day],
    );
    if (existing?.locked) throw new AppError("ALREADY_CLOSED");
    const tickets = await loadTickets(t, { status: "cerrado", closedDay: a.day });
    const [{ n }] = await t.query<{ n: number }>(`select count(*)::int as n from tickets where status = 'abierto'`);
    const r = computeClosing({ day: a.day, tickets, base: a.base, real: a.real, note: a.note, openTicketsCount: n });
    if (!r.canClose && r.reason) throw new AppError(r.reason);
    const expected = {} as Record<Medio, number>;
    const real = {} as Record<Medio, number | null>;
    const diff = {} as Record<Medio, number | null>;
    for (const m of MEDIOS) {
      const row = r.rows.find((x) => x.medio === m)!;
      expected[m] = row.expected;
      real[m] = row.real;
      diff[m] = row.diff;
    }
    const values = [
      a.day,
      a.base,
      JSON.stringify(expected),
      JSON.stringify(real),
      JSON.stringify(diff),
      r.sales,
      r.service,
      r.ticketCount,
      a.note.trim(),
      a.userId,
    ];
    if (existing) {
      await t.query(
        `update day_closings set base = $2, expected = $3::jsonb, real = $4::jsonb, diff = $5::jsonb, sales = $6,
           service = $7, ticket_count = $8, note = $9, closed_by = $10, closed_at = now(), locked = true
         where day = $1`,
        values,
      );
    } else {
      await t.query(
        `insert into day_closings (day, base, expected, real, diff, sales, service, ticket_count, note, closed_by)
         values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10)`,
        values,
      );
    }
  });
}

export async function reopenDay(db: Db, a: { day: string; reason: string; userId: string }): Promise<void> {
  const reason = a.reason.trim();
  if (!reason) throw new AppError("REASON_REQUIRED");
  await db.tx(async (t) => {
    const [row] = await t.query<{ locked: boolean; reopened: unknown[] }>(
      `select locked, reopened from day_closings where day = $1 for update`,
      [a.day],
    );
    if (!row?.locked) throw new AppError("NOT_CLOSED");
    const log = [...row.reopened, { at: new Date().toISOString(), reason, by: a.userId }];
    await t.query(`update day_closings set locked = false, reopened = $2::jsonb where day = $1`, [
      a.day,
      JSON.stringify(log),
    ]);
  });
}
