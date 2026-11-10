import { businessDay } from "./day";
import { serviceAmount, subtotal } from "./money";
import { MEDIOS, type Medio, type Ticket } from "./types";

export type ClosingReason = "OPEN_TICKETS" | "CASH_REQUIRED" | "NOTE_REQUIRED";

function closedOnDay(tickets: Ticket[], day: string): Ticket[] {
  return tickets.filter((t) => t.status === "cerrado" && t.closedAt !== null && businessDay(t.closedAt) === day);
}

export function expectedByMedio(tickets: Ticket[], day: string, base: number): Record<Medio, number> {
  const out: Record<Medio, number> = { efectivo: base, transferencia: 0, bre_b: 0, bold: 0 };
  for (const t of closedOnDay(tickets, day)) {
    for (const p of t.payments) {
      if (p.medio !== "sin_medio") out[p.medio] += p.applied;
    }
  }
  return out;
}

export interface ClosingInput {
  day: string;
  tickets: Ticket[];
  base: number;
  real: Partial<Record<Medio, number | null>>;
  note: string;
  openTicketsCount: number;
}

export interface ClosingResult {
  rows: { medio: Medio; expected: number; real: number | null; diff: number | null }[];
  hasDiff: boolean;
  canClose: boolean;
  reason: ClosingReason | null;
  sales: number;
  service: number;
  ticketCount: number;
}

export function computeClosing(i: ClosingInput): ClosingResult {
  const expected = expectedByMedio(i.tickets, i.day, i.base);
  const rows = MEDIOS.map((medio) => {
    const real = i.real[medio] ?? null;
    return { medio, expected: expected[medio], real, diff: real === null ? null : real - expected[medio] };
  });
  const hasDiff = rows.some((r) => r.diff !== null && r.diff !== 0);
  const day = closedOnDay(i.tickets, i.day);
  let reason: ClosingReason | null = null;
  if (i.openTicketsCount > 0) reason = "OPEN_TICKETS";
  else if (rows[0].real === null) reason = "CASH_REQUIRED";
  else if (hasDiff && i.note.trim() === "") reason = "NOTE_REQUIRED";
  return {
    rows,
    hasDiff,
    canClose: reason === null,
    reason,
    sales: day.reduce((s, t) => s + subtotal(t), 0),
    service: day.reduce((s, t) => s + serviceAmount(t, 0), 0),
    ticketCount: day.length,
  };
}
