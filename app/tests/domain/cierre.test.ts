import { describe, expect, test } from "vitest";
import { businessDay } from "@/domain/day";
import { computeClosing, expectedByMedio } from "@/domain/cierre";
import type { Ticket } from "@/domain/types";
import { line, payment, ticket } from "../helpers/ticket";

const DAY = "2026-11-08";

function cerrada(o: Partial<Ticket> = {}, cash = 10000, bold = 0): Ticket {
  const payments = [payment({ medio: "efectivo", applied: cash })];
  if (bold) payments.push(payment({ medio: "bold", applied: bold }));
  return ticket({
    status: "cerrado",
    closedAt: "2026-11-08T20:00:00.000Z",
    lines: [line({ qty: 1, unitPrice: cash + bold })],
    payments,
    ...o,
  });
}

describe("businessDay", () => {
  test("una venta de las 23:30 en Bogotá cae en el día correcto", () => {
    expect(businessDay("2026-11-09T04:30:00Z")).toBe("2026-11-08");
  });

  test("a la medianoche de Bogotá empieza el día siguiente", () => {
    expect(businessDay("2026-11-09T05:00:00Z")).toBe("2026-11-09");
  });
});

describe("expectedByMedio", () => {
  test("cuenta solo cuentas cerradas de ese día e incluye la base en efectivo", () => {
    const tickets = [
      cerrada({}, 10000, 5000),
      cerrada({ closedAt: "2026-11-09T20:00:00.000Z" }, 99999),
      cerrada({ status: "anulado", voidReason: "error" }, 3000),
      cerrada({ status: "abierto", closedAt: null }, 4000),
    ];
    expect(expectedByMedio(tickets, DAY, 20000)).toEqual({
      efectivo: 30000,
      transferencia: 0,
      bre_b: 0,
      bold: 5000,
    });
  });

  test("una cuenta cerrada pasada la medianoche UTC se cuenta en el día de Bogotá", () => {
    const tarde = cerrada({ closedAt: "2026-11-09T04:30:00.000Z" }, 7000);
    expect(expectedByMedio([tarde], DAY, 0).efectivo).toBe(7000);
  });

  test("los pagos sin_medio no entran en ningún medio", () => {
    const t = cerrada({}, 0);
    t.payments = [payment({ medio: "sin_medio", applied: 8000 })];
    expect(expectedByMedio([t], DAY, 0)).toEqual({ efectivo: 0, transferencia: 0, bre_b: 0, bold: 0 });
  });
});

describe("computeClosing", () => {
  const base = { day: DAY, base: 20000, note: "", openTicketsCount: 0 };

  test("cuadra cuando lo real es igual a lo esperado", () => {
    const r = computeClosing({ ...base, tickets: [cerrada()], real: { efectivo: 30000 } });
    expect(r.hasDiff).toBe(false);
    expect(r.canClose).toBe(true);
    expect(r.reason).toBeNull();
    expect(r.rows.find((x) => x.medio === "efectivo")).toEqual({
      medio: "efectivo",
      expected: 30000,
      real: 30000,
      diff: 0,
    });
  });

  test("no deja cerrar con cuentas abiertas", () => {
    const r = computeClosing({ ...base, tickets: [cerrada()], real: { efectivo: 30000 }, openTicketsCount: 1 });
    expect(r).toMatchObject({ canClose: false, reason: "OPEN_TICKETS" });
  });

  test("exige el efectivo contado", () => {
    const r = computeClosing({ ...base, tickets: [cerrada()], real: {} });
    expect(r).toMatchObject({ canClose: false, reason: "CASH_REQUIRED" });
  });

  test("exige nota cuando hay diferencia", () => {
    const sinNota = computeClosing({ ...base, tickets: [cerrada()], real: { efectivo: 29000 } });
    expect(sinNota).toMatchObject({ hasDiff: true, canClose: false, reason: "NOTE_REQUIRED" });
    const conNota = computeClosing({ ...base, note: "faltó sencillo", tickets: [cerrada()], real: { efectivo: 29000 } });
    expect(conNota.canClose).toBe(true);
    expect(conNota.rows[0].diff).toBe(-1000);
  });

  test("los medios opcionales sin valor tienen diferencia nula", () => {
    const r = computeClosing({ ...base, tickets: [cerrada()], real: { efectivo: 30000 } });
    expect(r.rows.filter((x) => x.medio !== "efectivo").every((x) => x.real === null && x.diff === null)).toBe(true);
  });

  test("un día sin ventas espera solo la base", () => {
    const r = computeClosing({ ...base, base: 5000, tickets: [], real: { efectivo: 5000 } });
    expect(r).toMatchObject({ sales: 0, ticketCount: 0, canClose: true });
    expect(r.rows[0].expected).toBe(5000);
  });

  test("ventas suma subtotales y servicio suma lo congelado", () => {
    const t = cerrada({ service: { enabled: true, custom: null, frozenAmount: 1000 } }, 11000);
    const r = computeClosing({ ...base, base: 0, tickets: [t], real: { efectivo: 11000 } });
    expect(r).toMatchObject({ sales: 11000, service: 1000, ticketCount: 1 });
  });

  test("una cuenta anulada con pago parcial no suma en el esperado ni en ventas", () => {
    const anulada = cerrada({ status: "anulado", voidReason: "error" }, 3000);
    const r = computeClosing({ ...base, base: 0, tickets: [anulada, cerrada()], real: { efectivo: 10000 } });
    expect(r.rows[0].expected).toBe(10000);
    expect(r.sales).toBe(10000);
  });
});
