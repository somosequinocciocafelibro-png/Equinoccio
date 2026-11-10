import { describe, expect, test } from "vitest";
import { balance, planPayment, serviceAmount, subtotal, total } from "@/domain/money";
import { line, payment, ticket } from "../helpers/ticket";

const vainilla = { id: "vainilla", name: "Vainilla", delta: 500 };
const sample = () =>
  ticket({ lines: [line({ qty: 2, unitPrice: 8000 }), line({ qty: 1, unitPrice: 9000, extras: [vainilla] })] });

describe("subtotal y servicio", () => {
  test("subtotal suma qty × (unitPrice + extras)", () => {
    expect(subtotal(sample())).toBe(25500);
  });

  test("serviceAmount es 10% redondeado a 100", () => {
    expect(serviceAmount(sample(), 10)).toBe(2600);
    expect(serviceAmount(ticket(), 10)).toBe(0);
  });

  test("serviceAmount es 0 si enabled es false", () => {
    const t = sample();
    t.service.enabled = false;
    expect(serviceAmount(t, 10)).toBe(0);
  });

  test("serviceAmount usa el valor custom y el total lo suma", () => {
    const t = sample();
    t.service.custom = 3000;
    expect(serviceAmount(t, 10)).toBe(3000);
    expect(total(t, 10)).toBe(28500);
  });

  test("serviceAmount queda congelado tras el primer pago", () => {
    const t = sample();
    t.payments = [payment({ applied: 10000 })];
    t.service.frozenAmount = 2600;
    expect(serviceAmount(t, 0)).toBe(2600);
  });

  test("una cuenta cerrada sin frozenAmount tiene servicio 0", () => {
    const t = sample();
    t.status = "cerrado";
    expect(serviceAmount(t, 10)).toBe(0);
  });

  test("total es subtotal más servicio y balance descuenta lo aplicado", () => {
    const t = sample();
    expect(total(t, 10)).toBe(28100);
    t.payments = [payment({ applied: 10000 })];
    t.service.frozenAmount = 2600;
    expect(balance(t, 10)).toBe(18100);
  });
});

describe("planPayment", () => {
  test("sin monto usa el saldo", () => {
    expect(planPayment(sample(), 10, { medio: "bold", amount: null, received: null })).toEqual({
      ok: true,
      applied: 28100,
      received: 28100,
      change: 0,
    });
  });

  test("rechaza un monto mayor al saldo", () => {
    expect(planPayment(sample(), 10, { medio: "bold", amount: 30000, received: null })).toEqual({
      ok: false,
      error: "EXCEEDS_BALANCE",
    });
  });

  test("rechaza un monto en cero o una cuenta ya pagada", () => {
    expect(planPayment(sample(), 10, { medio: "bold", amount: 0, received: null })).toEqual({
      ok: false,
      error: "AMOUNT_ZERO",
    });
    const pagada = sample();
    pagada.payments = [payment({ applied: 28100 })];
    pagada.service.frozenAmount = 2600;
    expect(planPayment(pagada, 10, { medio: "bold", amount: null, received: null })).toEqual({
      ok: false,
      error: "AMOUNT_ZERO",
    });
  });

  test("rechaza efectivo recibido menor al monto", () => {
    expect(planPayment(sample(), 10, { medio: "efectivo", amount: 20000, received: 15000 })).toEqual({
      ok: false,
      error: "CASH_SHORT",
    });
  });

  test("los medios que no son efectivo ignoran lo recibido", () => {
    expect(planPayment(sample(), 10, { medio: "bold", amount: 10000, received: 99999 })).toEqual({
      ok: true,
      applied: 10000,
      received: 10000,
      change: 0,
    });
  });

  test("efectivo de 50000 por 28100 devuelve 21900 de cambio", () => {
    expect(planPayment(sample(), 10, { medio: "efectivo", amount: null, received: 50000 })).toEqual({
      ok: true,
      applied: 28100,
      received: 50000,
      change: 21900,
    });
  });

  test("rechaza una cuenta sin líneas", () => {
    expect(planPayment(ticket(), 10, { medio: "efectivo", amount: 1000, received: null })).toEqual({
      ok: false,
      error: "EMPTY_TICKET",
    });
  });
});
