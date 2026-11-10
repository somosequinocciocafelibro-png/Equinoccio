import type { Line, Payment, Ticket } from "@/domain/types";

let seq = 0;
const nextId = (p: string) => `${p}${++seq}`;

export function line(o: Partial<Line> = {}): Line {
  return { id: nextId("l"), productId: "latte", name: "Latte", unitPrice: 8000, qty: 1, extras: [], ...o };
}

export function payment(o: Partial<Payment> = {}): Payment {
  return { id: nextId("p"), medio: "efectivo", received: 1000, applied: 1000, createdAt: "2026-11-09T15:30:00.000Z", ...o };
}

export function ticket(o: Partial<Ticket> = {}): Ticket {
  return {
    id: nextId("t"),
    tableId: "luna-1",
    salon: "Luna",
    tableName: "Mesa 1",
    status: "abierto",
    openedAt: "2026-11-09T15:00:00.000Z",
    closedAt: null,
    lines: [],
    payments: [],
    service: { enabled: true, custom: null, frozenAmount: null },
    voidReason: null,
    ...o,
  };
}
