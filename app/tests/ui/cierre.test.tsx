// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CierreForm } from "@/app/cierre/cierre-form";
import { closeDayAction, reopenDayAction, voidTicketAction } from "@/app/cierre/actions";
import type { ClosingRecord } from "@/server/closings";
import { line, payment, ticket } from "../helpers/ticket";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
vi.mock("@/app/cierre/actions", () => ({
  closeDayAction: vi.fn(async () => ({ ok: true })),
  reopenDayAction: vi.fn(async () => ({ ok: true })),
  voidTicketAction: vi.fn(async () => ({ ok: true })),
}));

const DAY = "2026-11-08";
const venta = () =>
  ticket({
    id: "t1",
    status: "cerrado",
    closedAt: "2026-11-08T20:00:00.000Z",
    lines: [line({ qty: 1, unitPrice: 10000 })],
    payments: [payment({ medio: "efectivo", applied: 10000 })],
  });
const base = { day: DAY, isAdmin: false, tickets: [venta()], voided: [], openCount: 0, closing: null as ClosingRecord | null };
const cerrado: ClosingRecord = {
  day: DAY,
  base: 0,
  expected: { efectivo: 10000, transferencia: 0, bre_b: 0, bold: 0 },
  real: { efectivo: 10000, transferencia: null, bre_b: null, bold: null },
  diff: { efectivo: 0, transferencia: null, bre_b: null, bold: null },
  sales: 10000,
  service: 800,
  ticketCount: 1,
  note: "",
  closedAt: "2026-11-09T03:00:00.000Z",
  locked: true,
  reopened: [],
};

beforeEach(() => {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const boton = () => screen.getByRole("button", { name: "Cerrar día" }) as HTMLButtonElement;

describe("CierreForm", () => {
  test("pide el efectivo contado antes de dejar cerrar", () => {
    render(<CierreForm {...base} />);
    expect(boton().disabled).toBe(true);
    expect(screen.getByText("Escribe el efectivo contado en caja.")).toBeTruthy();
  });

  test("con una diferencia muestra el valor y exige una nota", async () => {
    render(<CierreForm {...base} />);
    await userEvent.type(screen.getByLabelText("Real Efectivo"), "9000");
    expect(screen.getByText("−$1.000")).toBeTruthy();
    expect(boton().disabled).toBe(true);
    expect(screen.getByText("Hay diferencias: escribe una nota para poder cerrar.")).toBeTruthy();
    await userEvent.type(screen.getByLabelText(/Nota/), "faltó sencillo");
    expect(boton().disabled).toBe(false);
  });

  test("con cuentas abiertas no deja cerrar y lo explica", () => {
    render(<CierreForm {...base} openCount={2} />);
    expect(boton().disabled).toBe(true);
    expect(screen.getAllByText(/Hay cuentas abiertas/).length).toBeGreaterThan(0);
  });

  test("al cerrar envía la base, los reales y la nota", async () => {
    render(<CierreForm {...base} />);
    await userEvent.type(screen.getByLabelText(/Base de caja/), "5000");
    await userEvent.type(screen.getByLabelText("Real Efectivo"), "15000");
    await userEvent.click(boton());
    expect(closeDayAction).toHaveBeenCalledWith({
      day: DAY,
      base: 5000,
      real: { efectivo: 15000, transferencia: null, bre_b: null, bold: null },
      note: "",
    });
  });

  test("un día cerrado muestra el resumen con el servicio y solo el admin puede reabrirlo", () => {
    const { unmount } = render(<CierreForm {...base} closing={cerrado} />);
    expect(screen.getByText(/Día cerrado/)).toBeTruthy();
    expect(screen.getByText(/Servicio recaudado/).textContent).toContain("$800");
    expect(screen.queryByRole("button", { name: "Reabrir día" })).toBeNull();
    unmount();
    render(<CierreForm {...base} isAdmin closing={cerrado} />);
    expect(screen.getByRole("button", { name: "Reabrir día" })).toBeTruthy();
  });

  test("el admin reabre el día con un motivo", async () => {
    render(<CierreForm {...base} isAdmin closing={cerrado} />);
    await userEvent.click(screen.getByRole("button", { name: "Reabrir día" }));
    await userEvent.type(screen.getByLabelText("Motivo"), "faltó una venta");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reapertura" }));
    expect(reopenDayAction).toHaveBeenCalledWith({ day: DAY, reason: "faltó una venta" });
  });

  test("el admin anula una cuenta con motivo y la caja no ve el botón", async () => {
    const { unmount } = render(<CierreForm {...base} />);
    expect(screen.queryByRole("button", { name: "Anular" })).toBeNull();
    unmount();
    render(<CierreForm {...base} isAdmin />);
    await userEvent.click(screen.getByRole("button", { name: "Anular" }));
    await userEvent.type(screen.getByLabelText("Motivo"), "pedido equivocado");
    await userEvent.click(screen.getByRole("button", { name: "Anular cuenta" }));
    expect(voidTicketAction).toHaveBeenCalledWith({ ticketId: "t1", reason: "pedido equivocado" });
  });

  test("muestra en español el error del servidor", async () => {
    vi.mocked(closeDayAction).mockResolvedValueOnce({ ok: false, error: "OPEN_TICKETS" });
    render(<CierreForm {...base} />);
    await userEvent.type(screen.getByLabelText("Real Efectivo"), "10000");
    await userEvent.click(boton());
    expect((await screen.findAllByText(/Hay cuentas abiertas/)).length).toBeGreaterThan(0);
  });
});
