// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ErrorPage from "@/app/error";
import { voidTicketAction } from "@/app/cierre/actions";
import { CierreForm } from "@/app/cierre/cierre-form";
import { PaymentPanel } from "@/app/mesas/[tableId]/cobro";
import { TicketScreen } from "@/app/mesas/[tableId]/ticket-screen";
import { addLineAction, addPaymentAction, removePaymentAction, setServiceAction } from "@/app/mesas/actions";
import type { Ticket } from "@/domain/types";
import { line, payment, ticket } from "../helpers/ticket";

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));
vi.mock("@/app/mesas/actions", () => ({
  addLineAction: vi.fn(async () => ({ ok: true, ticketId: "t1" })),
  setQtyAction: vi.fn(async () => ({ ok: true })),
  toggleExtraAction: vi.fn(async () => ({ ok: true })),
  setServiceAction: vi.fn(async () => ({ ok: true })),
  addPaymentAction: vi.fn(async () => ({ ok: true, paymentId: "p1", change: 0, closed: false })),
  removePaymentAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/app/cierre/actions", () => ({
  closeDayAction: vi.fn(async () => ({ ok: true })),
  reopenDayAction: vi.fn(async () => ({ ok: true })),
  voidTicketAction: vi.fn(async () => ({ ok: true })),
}));

const table = { id: "luna-1", name: "Mesa 1", salon: "Luna", capacity: null, isTakeout: false, displayName: "Luna · Mesa 1" };
const products = [
  { id: "latte", name: "Latte", category: "Café", price: 8000 },
  { id: "espresso", name: "Espresso", category: "Café", price: 4000 },
];
const abierta = (): Ticket => ticket({ id: "t1", lines: [line({ qty: 2, unitPrice: 8000 })] }); // subtotal 16000, servicio 1600
const screen0 = (o: Partial<Parameters<typeof TicketScreen>[0]> = {}) => (
  <TicketScreen table={table} ticket={null} products={products} extras={[]} pct={10} {...o} />
);

beforeEach(() => {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("anular una cuenta abierta (C1)", () => {
  test("solo el admin ve el botón para anular", () => {
    render(screen0({ ticket: abierta() }));
    expect(screen.queryByRole("button", { name: "Anular cuenta" })).toBeNull();
    cleanup();
    render(screen0({ ticket: abierta(), canVoid: true }));
    expect(screen.getByRole("button", { name: "Anular cuenta" })).toBeTruthy();
  });

  test("anula con un motivo y no llama al servidor si el motivo está vacío", async () => {
    render(screen0({ ticket: abierta(), canVoid: true }));
    await userEvent.click(screen.getByRole("button", { name: "Anular cuenta" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar anulación" }));
    expect(voidTicketAction).not.toHaveBeenCalled();
    expect(screen.getByText("Escribe el motivo.")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Motivo"), "el cliente se fue");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar anulación" }));
    expect(voidTicketAction).toHaveBeenCalledWith({ ticketId: "t1", reason: "el cliente se fue" });
  });

  test("el cierre lista las cuentas abiertas con un enlace para resolverlas", () => {
    render(
      <CierreForm
        day="2026-11-08"
        isAdmin={false}
        tickets={[]}
        voided={[]}
        openCount={1}
        closing={null}
        openTickets={[{ id: "t7", tableId: "sol-2", tableName: "Sol · Mesa 2", subtotal: 12500 }]}
      />,
    );
    const link = screen.getByRole("link", { name: /Sol · Mesa 2/ });
    expect(link.getAttribute("href")).toBe("/mesas/sol-2?ticket=t7");
    expect(screen.getByText(/\$12\.500/)).toBeTruthy();
  });
});

describe("el servicio y el total que ve quien cobra (I2)", () => {
  test("mientras se guarda el servicio no se puede registrar el pago", async () => {
    let terminar: (v: Awaited<ReturnType<typeof setServiceAction>>) => void = () => {};
    vi.mocked(setServiceAction).mockImplementationOnce(() => new Promise((r) => (terminar = r)));
    render(<PaymentPanel ticket={abierta()} pct={10} onPaid={vi.fn()} />);
    await userEvent.click(screen.getByLabelText(/Servicio voluntario/));
    expect((screen.getByRole("button", { name: "Registrar pago" }) as HTMLButtonElement).disabled).toBe(true);
    terminar({ ok: true });
    await vi.waitFor(() => expect((screen.getByRole("button", { name: "Registrar pago" }) as HTMLButtonElement).disabled).toBe(false));
  });

  test("si no se pudo guardar el servicio se avisa y no se deja cobrar", async () => {
    vi.mocked(setServiceAction).mockResolvedValueOnce({ ok: false, error: "TICKET_NOT_OPEN" });
    render(<PaymentPanel ticket={abierta()} pct={10} onPaid={vi.fn()} />);
    await userEvent.click(screen.getByLabelText(/Servicio voluntario/));
    expect(await screen.findByText("La cuenta ya no está abierta.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Registrar pago" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("envía con el pago el total que la pantalla mostraba", async () => {
    render(<PaymentPanel ticket={abierta()} pct={10} onPaid={vi.fn()} />);
    await userEvent.click(screen.getByLabelText(/Servicio voluntario/));
    await vi.waitFor(() => expect((screen.getByRole("button", { name: "Registrar pago" }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
    await vi.waitFor(() => expect(addPaymentAction).toHaveBeenCalled());
    expect(vi.mocked(addPaymentAction).mock.calls[0][0]).toMatchObject({ expectedTotal: 16000 });
  });
});

describe("rechazos del servidor y fallas de red (I3)", () => {
  test("si agregar un producto falla por la red, se avisa y la pantalla sigue", async () => {
    vi.mocked(addLineAction).mockRejectedValueOnce(new Error("fetch failed"));
    render(screen0());
    await userEvent.click(screen.getByRole("button", { name: /Latte/ }));
    expect(await screen.findByText(/No se pudo guardar/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Latte/ })).toBeTruthy();
  });

  test("quitar un pago muestra el error del servidor", async () => {
    vi.mocked(removePaymentAction).mockResolvedValueOnce({ ok: false, error: "TICKET_NOT_OPEN" });
    const t = abierta();
    t.payments = [payment({ id: "p9", medio: "bold", applied: 5000 })];
    t.service.frozenAmount = 1600;
    render(<PaymentPanel ticket={t} pct={10} onPaid={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Quitar pago" }));
    expect(await screen.findByText("La cuenta ya no está abierta.")).toBeTruthy();
  });

  test("quitar un pago no funciona sin conexión", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    const t = abierta();
    t.payments = [payment({ id: "p9", medio: "bold", applied: 5000 })];
    t.service.frozenAmount = 1600;
    render(<PaymentPanel ticket={t} pct={10} onPaid={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Quitar pago" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("la página de error ofrece reintentar en español", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);
    expect(screen.getByText(/Algo salió mal/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(reset).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Ir a mesas" }).getAttribute("href")).toBe("/mesas");
  });
});

describe("una venta nueva no se parte en dos cuentas (I4)", () => {
  test("el segundo producto usa la cuenta que acaba de crear el primero", async () => {
    vi.mocked(addLineAction).mockResolvedValueOnce({ ok: true, ticketId: "t9" });
    render(screen0());
    await userEvent.click(screen.getByRole("button", { name: /Latte/ }));
    await vi.waitFor(() => expect((screen.getByRole("button", { name: /Espresso/ }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(screen.getByRole("button", { name: /Espresso/ }));
    expect(addLineAction).toHaveBeenNthCalledWith(1, { tableId: "luna-1", ticketId: null, productId: "latte", qty: 1 });
    expect(addLineAction).toHaveBeenNthCalledWith(2, { tableId: "luna-1", ticketId: "t9", productId: "espresso", qty: 1 });
  });

  test("si la cuenta ya no está abierta, reintenta una vez con una cuenta nueva", async () => {
    vi.mocked(addLineAction)
      .mockResolvedValueOnce({ ok: false, error: "TICKET_NOT_OPEN" })
      .mockResolvedValueOnce({ ok: true, ticketId: "t2" });
    render(screen0({ ticket: abierta() }));
    await userEvent.click(screen.getByRole("button", { name: /Espresso/ }));
    await vi.waitFor(() => expect(addLineAction).toHaveBeenCalledTimes(2));
    expect(addLineAction).toHaveBeenNthCalledWith(1, { tableId: "luna-1", ticketId: "t1", productId: "espresso", qty: 1 });
    expect(addLineAction).toHaveBeenNthCalledWith(2, { tableId: "luna-1", ticketId: null, productId: "espresso", qty: 1 });
  });
});
