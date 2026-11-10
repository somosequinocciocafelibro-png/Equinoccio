import { describe, expect, test } from "vitest";
import { reportSales } from "@/domain/reports";
import type { PaymentMedio, Ticket } from "@/domain/types";
import { line, payment, ticket } from "../helpers/ticket";

const range = { from: "2026-11-08", to: "2026-11-09" };

function cerrada(day: string, o: Partial<Ticket> & { pays?: [PaymentMedio, number][] } = {}): Ticket {
  const { pays, ...rest } = o;
  return ticket({
    status: "cerrado",
    closedAt: `${day}T20:00:00.000Z`,
    lines: [line({ qty: 1, unitPrice: 10000 })],
    payments: (pays ?? [["efectivo", 10000]]).map(([medio, applied]) => payment({ medio, applied })),
    ...rest,
  });
}

describe("reportSales", () => {
  test("solo cuenta cuentas cerradas dentro del rango, inclusive", () => {
    const r = reportSales(
      [
        cerrada("2026-11-07"),
        cerrada("2026-11-08"),
        cerrada("2026-11-09"),
        cerrada("2026-11-10"),
        cerrada("2026-11-08", { status: "anulado", voidReason: "x" }),
        cerrada("2026-11-08", { status: "abierto", closedAt: null }),
      ],
      range,
    );
    expect(r.count).toBe(2);
    expect(r.sales).toBe(20000);
  });

  test("las ventas usan el subtotal y el servicio va aparte, pero entra en los medios", () => {
    const t = cerrada("2026-11-08", {
      service: { enabled: true, custom: null, frozenAmount: 1000 },
      pays: [
        ["efectivo", 6000],
        ["bold", 5000],
      ],
    });
    const sinMedio = cerrada("2026-11-08", { pays: [["sin_medio", 10000]] });
    const r = reportSales([t, sinMedio], range);
    expect(r.sales).toBe(20000);
    expect(r.service).toBe(1000);
    const esperado: Record<PaymentMedio, number> = {
      efectivo: 6000,
      transferencia: 0,
      bre_b: 0,
      bold: 5000,
      sin_medio: 10000,
    };
    expect(r.byMedio).toEqual(esperado);
  });

  test("byDay va en orden ascendente", () => {
    const r = reportSales([cerrada("2026-11-09"), cerrada("2026-11-08"), cerrada("2026-11-08")], range);
    expect(r.byDay).toEqual([
      { day: "2026-11-08", sales: 20000 },
      { day: "2026-11-09", sales: 10000 },
    ]);
  });

  test("byProduct agrupa por productId y respeta el precio con el que se vendió", () => {
    const vieja = cerrada("2026-11-08", { lines: [line({ productId: "latte", name: "Latte", unitPrice: 8000, qty: 1 })] });
    const nueva = cerrada("2026-11-09", { lines: [line({ productId: "latte", name: "Latte", unitPrice: 9000, qty: 1 })] });
    const r = reportSales([vieja, nueva], range);
    expect(r.byProduct).toEqual([{ productId: "latte", name: "Latte", qty: 2, sales: 17000 }]);
  });

  test("bySalon usa 'Sin salón' cuando la cuenta no tiene salón y byTable une salón y mesa", () => {
    const a = cerrada("2026-11-08", { salon: null, tableName: "Barra" });
    const b = cerrada("2026-11-08", { salon: "Luna", tableName: "Mesa 1" });
    const r = reportSales([a, b], range);
    expect(r.bySalon.map((x) => x.salon).sort()).toEqual(["Luna", "Sin salón"]);
    expect(r.byTable.map((x) => x.table).sort()).toEqual(["Barra", "Luna · Mesa 1"]);
  });

  test("el promedio es ventas entre cuentas, y 0 sin cuentas", () => {
    expect(reportSales([cerrada("2026-11-08", { lines: [line({ unitPrice: 10000 })] }), cerrada("2026-11-08", { lines: [line({ unitPrice: 5000 })] })], range).avg).toBe(7500);
    expect(reportSales([], range)).toMatchObject({ avg: 0, count: 0, sales: 0 });
  });
});
