import type { Line, Medio, Ticket } from "./types";

export function lineTotal(l: Line): number {
  const extras = l.extras.reduce((s, e) => s + e.delta, 0);
  return (l.unitPrice + extras) * l.qty;
}

export function subtotal(t: Ticket): number {
  return t.lines.reduce((s, l) => s + lineTotal(l), 0);
}

/** Servicio voluntario: congelado desde el primer pago; 0 en cuentas cerradas sin monto congelado. */
export function serviceAmount(t: Ticket, pct: number): number {
  if (t.status !== "abierto") return t.service.frozenAmount ?? 0;
  if (t.payments.length > 0 && t.service.frozenAmount !== null) return t.service.frozenAmount;
  if (!t.service.enabled) return 0;
  if (t.service.custom !== null) return t.service.custom;
  return Math.round((subtotal(t) * pct) / 10000) * 100;
}

export function total(t: Ticket, pct: number): number {
  return subtotal(t) + serviceAmount(t, pct);
}

export function balance(t: Ticket, pct: number): number {
  return total(t, pct) - t.payments.reduce((s, p) => s + p.applied, 0);
}

export type PaymentPlan =
  | { ok: true; applied: number; received: number; change: number }
  | { ok: false; error: "AMOUNT_ZERO" | "EXCEEDS_BALANCE" | "CASH_SHORT" | "EMPTY_TICKET" };

export function planPayment(
  t: Ticket,
  pct: number,
  i: { medio: Medio; amount: number | null; received: number | null },
): PaymentPlan {
  if (t.lines.length === 0) return { ok: false, error: "EMPTY_TICKET" };
  const saldo = balance(t, pct);
  const applied = i.amount ?? saldo;
  if (applied <= 0) return { ok: false, error: "AMOUNT_ZERO" };
  if (applied > saldo) return { ok: false, error: "EXCEEDS_BALANCE" };
  if (i.medio !== "efectivo") return { ok: true, applied, received: applied, change: 0 };
  const received = i.received ?? applied;
  if (received < applied) return { ok: false, error: "CASH_SHORT" };
  return { ok: true, applied, received, change: received - applied };
}
