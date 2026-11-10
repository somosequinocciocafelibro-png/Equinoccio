import { randomUUID } from "node:crypto";
import { businessDay } from "@/domain/day";
import { balance, planPayment, serviceAmount, total } from "@/domain/money";
import { MEDIOS, type Extra, type Medio } from "@/domain/types";
import { isDayClosed, loadTickets } from "./closings";
import type { Db } from "./db";
import { AppError } from "./errors";

const today = () => businessDay(new Date().toISOString());

async function assertTodayOpen(t: Db): Promise<void> {
  if (await isDayClosed(t, today())) throw new AppError("DAY_CLOSED");
}

/** Bloquea la fila de la cuenta (serializa cambios concurrentes) y exige que siga abierta. */
async function lockOpenTicket(t: Db, ticketId: string): Promise<void> {
  const [row] = await t.query<{ status: string }>(`select status from tickets where id = $1 for update`, [ticketId]);
  if (!row) throw new AppError("TICKET_NOT_FOUND");
  if (row.status !== "abierto") throw new AppError("TICKET_NOT_OPEN");
}

/**
 * Después de quitar o cambiar líneas: una cuenta sin pagos y sin productos se anula como vacía (la mesa queda libre);
 * una cuenta con pagos no puede quedar por debajo de lo ya pagado, y si el saldo queda en cero se cierra.
 */
async function afterEdit(t: Db, ticketId: string): Promise<void> {
  const [ticket] = await loadTickets(t, { ids: [ticketId] });
  const [{ service_pct: pct }] = await t.query<{ service_pct: number }>(`select service_pct from settings`);
  if (ticket.payments.length === 0) {
    if (ticket.lines.length === 0) {
      await t.query(
        `update tickets set status = 'anulado', void_reason = 'Cuenta vacía', voided_by = 'sistema', voided_at = now() where id = $1`,
        [ticketId],
      );
    }
    return;
  }
  const saldo = balance(ticket, pct);
  if (saldo < 0) throw new AppError("BELOW_PAID");
  if (saldo === 0 && ticket.lines.length > 0) {
    await t.query(`update tickets set status = 'cerrado', closed_at = now() where id = $1`, [ticketId]);
  }
}

export async function openTicket(db: Db, a: { tableId: string; userId: string }): Promise<string> {
  return db.tx(async (t) => {
    const [mesa] = await t.query<{ id: string; name: string; salon: string | null; is_takeout: boolean }>(
      `select id, name, salon, is_takeout from dining_tables where id = $1 and active`,
      [a.tableId],
    );
    if (!mesa) throw new AppError("TABLE_NOT_FOUND");
    const findOpen = async () => {
      const [open] = await t.query<{ id: string }>(
        `select id from tickets where table_id = $1 and status = 'abierto' limit 1`,
        [mesa.id],
      );
      return open?.id;
    };
    if (!mesa.is_takeout) {
      const existing = await findOpen();
      if (existing) return existing;
    }
    await assertTodayOpen(t);
    const rows = await t.query<{ id: string }>(
      `insert into tickets (id, table_id, table_name, salon, is_takeout, created_by)
       values ($1, $2, $3, $4, $5, $6) on conflict do nothing returning id`,
      [`t-${randomUUID()}`, mesa.id, mesa.name, mesa.salon, mesa.is_takeout, a.userId],
    );
    if (rows.length) return rows[0].id;
    const raced = await findOpen();
    if (!raced) throw new AppError("TICKET_NOT_FOUND");
    return raced;
  });
}

export async function addLine(db: Db, a: { ticketId: string; productId: string; qty: number }): Promise<void> {
  if (!Number.isInteger(a.qty) || a.qty <= 0) throw new AppError("INVALID_QTY");
  await db.tx(async (t) => {
    await lockOpenTicket(t, a.ticketId);
    const [p] = await t.query<{ id: string; name: string; price: number }>(
      `select id, name, price from products where id = $1 and active`,
      [a.productId],
    );
    if (!p) throw new AppError("PRODUCT_NOT_FOUND");
    const merged = await t.query(
      `update ticket_lines set qty = qty + $3
       where id = (select id from ticket_lines where ticket_id = $1 and product_id = $2 and extras = '[]'::jsonb
                   and unit_price = $4 order by created_at, id limit 1)
       returning id`,
      [a.ticketId, p.id, a.qty, p.price],
    );
    if (merged.length === 0) {
      await t.query(
        `insert into ticket_lines (id, ticket_id, product_id, name, unit_price, qty) values ($1, $2, $3, $4, $5, $6)`,
        [`l-${randomUUID()}`, a.ticketId, p.id, p.name, p.price, a.qty],
      );
    }
  });
}

async function lineTicket(t: Db, lineId: string): Promise<string> {
  const [l] = await t.query<{ ticket_id: string }>(`select ticket_id from ticket_lines where id = $1`, [lineId]);
  if (!l) throw new AppError("LINE_NOT_FOUND");
  return l.ticket_id;
}

export async function setLineQty(db: Db, a: { lineId: string; qty: number }): Promise<void> {
  await db.tx(async (t) => {
    const ticketId = await lineTicket(t, a.lineId);
    await lockOpenTicket(t, ticketId);
    if (a.qty <= 0) {
      await t.query(`delete from ticket_lines where id = $1`, [a.lineId]);
    } else {
      if (!Number.isInteger(a.qty)) throw new AppError("INVALID_QTY");
      await t.query(`update ticket_lines set qty = $2 where id = $1`, [a.lineId, a.qty]);
    }
    await afterEdit(t, ticketId);
  });
}

export async function toggleExtra(db: Db, a: { lineId: string; extraId: string }): Promise<void> {
  await db.tx(async (t) => {
    await lockOpenTicket(t, await lineTicket(t, a.lineId));
    const [ex] = await t.query<{ id: string; name: string; delta: number }>(
      `select id, name, delta from extras where id = $1 and active`,
      [a.extraId],
    );
    if (!ex) throw new AppError("EXTRA_NOT_FOUND");
    const [line] = await t.query<{ extras: Extra[] }>(`select extras from ticket_lines where id = $1`, [a.lineId]);
    const has = line.extras.some((e) => e.id === ex.id);
    const next = has ? line.extras.filter((e) => e.id !== ex.id) : [...line.extras, { id: ex.id, name: ex.name, delta: ex.delta }];
    await t.query(`update ticket_lines set extras = $2::jsonb where id = $1`, [a.lineId, JSON.stringify(next)]);
    await afterEdit(t, await lineTicket(t, a.lineId));
  });
}

export async function setService(
  db: Db,
  a: { ticketId: string; enabled: boolean; custom: number | null },
): Promise<void> {
  await db.tx(async (t) => {
    await lockOpenTicket(t, a.ticketId);
    const [{ n }] = await t.query<{ n: number }>(`select count(*)::int as n from payments where ticket_id = $1`, [
      a.ticketId,
    ]);
    if (n > 0) throw new AppError("SERVICE_LOCKED");
    await t.query(`update tickets set service_enabled = $2, service_custom = $3 where id = $1`, [
      a.ticketId,
      a.enabled,
      a.custom,
    ]);
  });
}

export async function addPayment(
  db: Db,
  a: {
    ticketId: string;
    medio: Medio;
    amount: number | null;
    received: number | null;
    idempotencyKey: string;
    userId: string;
    /** Total que vio quien cobra; si ya no coincide con el de la cuenta, el pago se rechaza. */
    expectedTotal?: number;
  },
): Promise<{ paymentId: string; change: number; closed: boolean }> {
  if (!MEDIOS.includes(a.medio)) throw new AppError("INVALID_MEDIO");
  return db.tx(async (t) => {
    const [row] = await t.query<{ status: string }>(`select status from tickets where id = $1 for update`, [a.ticketId]);
    if (!row) throw new AppError("TICKET_NOT_FOUND");
    const [again] = await t.query<{ id: string; ticket_id: string; applied: number; received: number }>(
      `select id, ticket_id, applied, received from payments where idempotency_key = $1`,
      [a.idempotencyKey],
    );
    if (again && again.ticket_id === a.ticketId) {
      return { paymentId: again.id, change: again.received - again.applied, closed: row.status === "cerrado" };
    }
    if (row.status !== "abierto") throw new AppError("TICKET_NOT_OPEN");
    await assertTodayOpen(t);
    const [ticket] = await loadTickets(t, { ids: [a.ticketId] });
    const [{ service_pct: pct }] = await t.query<{ service_pct: number }>(`select service_pct from settings`);
    if (a.expectedTotal !== undefined && total(ticket, pct) !== a.expectedTotal) throw new AppError("TOTAL_CHANGED");
    const plan = planPayment(ticket, pct, { medio: a.medio, amount: a.amount, received: a.received });
    if (!plan.ok) throw new AppError(plan.error);
    const remaining = balance(ticket, pct) - plan.applied;
    if (ticket.payments.length === 0) {
      await t.query(`update tickets set service_frozen = $2 where id = $1`, [a.ticketId, serviceAmount(ticket, pct)]);
    }
    const paymentId = `p-${randomUUID()}`;
    await t.query(
      `insert into payments (id, ticket_id, medio, received, applied, idempotency_key, created_by)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [paymentId, a.ticketId, a.medio, plan.received, plan.applied, a.idempotencyKey, a.userId],
    );
    const closed = remaining === 0;
    if (closed) await t.query(`update tickets set status = 'cerrado', closed_at = now() where id = $1`, [a.ticketId]);
    return { paymentId, change: plan.change, closed };
  });
}

export async function removePayment(db: Db, a: { paymentId: string }): Promise<void> {
  await db.tx(async (t) => {
    const [p] = await t.query<{ ticket_id: string }>(`select ticket_id from payments where id = $1`, [a.paymentId]);
    if (!p) throw new AppError("PAYMENT_NOT_FOUND");
    await lockOpenTicket(t, p.ticket_id);
    await t.query(`delete from payments where id = $1`, [a.paymentId]);
    const [{ n }] = await t.query<{ n: number }>(`select count(*)::int as n from payments where ticket_id = $1`, [
      p.ticket_id,
    ]);
    if (n === 0) await t.query(`update tickets set service_frozen = null where id = $1`, [p.ticket_id]);
  });
}

export async function voidTicket(db: Db, a: { ticketId: string; reason: string; userId: string }): Promise<void> {
  const reason = a.reason.trim();
  if (!reason) throw new AppError("REASON_REQUIRED");
  await db.tx(async (t) => {
    const [row] = await t.query<{ status: string; closed_at: Date | string | null }>(
      `select status, closed_at from tickets where id = $1 for update`,
      [a.ticketId],
    );
    if (!row) throw new AppError("TICKET_NOT_FOUND");
    if (row.status === "anulado") throw new AppError("TICKET_NOT_OPEN");
    if (row.status === "cerrado" && row.closed_at && (await isDayClosed(t, businessDay(new Date(row.closed_at).toISOString())))) {
      throw new AppError("DAY_CLOSED");
    }
    await t.query(
      `update tickets set status = 'anulado', void_reason = $2, voided_by = $3, voided_at = now() where id = $1`,
      [a.ticketId, reason, a.userId],
    );
  });
}
