// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PaymentPanel } from "@/app/mesas/[tableId]/cobro";
import { TicketScreen } from "@/app/mesas/[tableId]/ticket-screen";
import { addPaymentAction, removePaymentAction, setServiceAction } from "@/app/mesas/actions";
import { subtotal } from "@/domain/money";
import { line, payment, ticket } from "../helpers/ticket";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/mesas/actions", () => ({
  addLineAction: vi.fn(async () => ({ ok: true, ticketId: "t1" })),
  setQtyAction: vi.fn(async () => ({ ok: true })),
  toggleExtraAction: vi.fn(async () => ({ ok: true })),
  setServiceAction: vi.fn(async () => ({ ok: true })),
  addPaymentAction: vi.fn(async () => ({ ok: true, paymentId: "p1", change: 0, closed: false })),
  removePaymentAction: vi.fn(async () => ({ ok: true })),
}));

const abierta = () => ticket({ id: "t1", lines: [line({ qty: 2, unitPrice: 8000 })] }); // subtotal 16000, servicio 1600
const onPaid = vi.fn();

beforeEach(() => {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("PaymentPanel: servicio", () => {
  test("el servicio aparece activado con el valor sugerido y suma al total", () => {
    render(<PaymentPanel ticket={abierta()} pct={10} onPaid={onPaid} />);
    expect((screen.getByLabelText(/Servicio voluntario/) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText("Valor del servicio").getAttribute("placeholder")).toBe("1600");
    expect(screen.getByText("Total a pagar").nextSibling?.textContent).toBe("$17.600");
  });

  test("quitar el servicio recalcula el total y avisa al servidor", async () => {
    render(<PaymentPanel ticket={abierta()} pct={10} onPaid={onPaid} />);
    await userEvent.click(screen.getByLabelText(/Servicio voluntario/));
    expect(screen.getByText("Total a pagar").nextSibling?.textContent).toBe("$16.000");
    expect(setServiceAction).toHaveBeenCalledWith({ ticketId: "t1", enabled: false, custom: null });
  });

  test("escribir otro valor recalcula el total", async () => {
    render(<PaymentPanel ticket={abierta()} pct={10} onPaid={onPaid} />);
    const input = screen.getByLabelText("Valor del servicio");
    await userEvent.type(input, "3000");
    await userEvent.tab();
    expect(screen.getByText("Total a pagar").nextSibling?.textContent).toBe("$19.000");
    expect(setServiceAction).toHaveBeenCalledWith({ ticketId: "t1", enabled: true, custom: 3000 });
  });

  test("con pagos registrados el servicio es de solo lectura", () => {
    const t = abierta();
    t.payments = [payment({ medio: "bold", applied: 5000 })];
    t.service.frozenAmount = 1600;
    render(<PaymentPanel ticket={t} pct={10} onPaid={onPaid} />);
    expect(screen.queryByLabelText(/Servicio voluntario/)).toBeNull();
    expect(screen.getByText("Servicio").nextSibling?.textContent).toBe("$1.600");
  });
});

describe("PaymentPanel: pagos", () => {
  test("en efectivo muestra el cambio a devolver", async () => {
    render(<PaymentPanel ticket={abierta()} pct={10} onPaid={onPaid} />);
    await userEvent.type(screen.getByLabelText(/Recibe del cliente/), "50000");
    expect(screen.getByText(/Cambio a devolver/).textContent).toContain("$32.400");
  });

  test("pulsar Registrar pago dos veces seguidas envía una sola acción con una clave", async () => {
    vi.mocked(addPaymentAction).mockImplementationOnce(
      () => new Promise((r) => setTimeout(() => r({ ok: true, paymentId: "p1", change: 0, closed: false }), 40)),
    );
    render(<PaymentPanel ticket={abierta()} pct={10} onPaid={onPaid} />);
    await userEvent.dblClick(screen.getByRole("button", { name: "Registrar pago" }));
    await vi.waitFor(() => expect(addPaymentAction).toHaveBeenCalledTimes(1));
    const arg = vi.mocked(addPaymentAction).mock.calls[0][0];
    expect(arg).toMatchObject({ ticketId: "t1", medio: "efectivo", amount: null, received: null });
    expect(arg.idempotencyKey.length).toBeGreaterThan(8);
    await vi.waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1));
    expect(addPaymentAction).toHaveBeenCalledTimes(1);
  });

  test("avisa con el total y el cambio cuando el pago cierra la cuenta", async () => {
    vi.mocked(addPaymentAction).mockResolvedValueOnce({ ok: true, paymentId: "p1", change: 32400, closed: true });
    render(<PaymentPanel ticket={abierta()} pct={10} onPaid={onPaid} />);
    await userEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
    await vi.waitFor(() => expect(onPaid).toHaveBeenCalledWith({ closed: true, change: 32400, total: 17600 }));
  });

  test("muestra el error en español cuando el servidor rechaza el pago", async () => {
    vi.mocked(addPaymentAction).mockResolvedValueOnce({ ok: false, error: "DAY_CLOSED" });
    render(<PaymentPanel ticket={abierta()} pct={10} onPaid={onPaid} />);
    await userEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
    expect(await screen.findByText(/día ya está cerrado/)).toBeTruthy();
    expect(onPaid).not.toHaveBeenCalled();
  });

  test("permite quitar un pago registrado", async () => {
    const t = abierta();
    t.payments = [payment({ id: "p9", medio: "bold", applied: 5000 })];
    t.service.frozenAmount = 1600;
    render(<PaymentPanel ticket={t} pct={10} onPaid={onPaid} />);
    await userEvent.click(screen.getByRole("button", { name: "Quitar pago" }));
    expect(removePaymentAction).toHaveBeenCalledWith({ paymentId: "p9" });
  });
});

describe("TicketScreen con cobro", () => {
  test("al cerrar la cuenta muestra el total y el cambio a devolver", async () => {
    vi.mocked(addPaymentAction).mockResolvedValueOnce({ ok: true, paymentId: "p1", change: 32400, closed: true });
    const t = abierta();
    const table = { id: "luna-1", name: "Mesa 1", salon: "Luna", capacity: null, isTakeout: false, displayName: "Luna · Mesa 1" };
    expect(subtotal(t)).toBe(16000);
    render(<TicketScreen table={table} ticket={t} products={[]} extras={[]} pct={10} />);
    await userEvent.click(screen.getByRole("button", { name: "Cobrar" }));
    await userEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
    expect(await screen.findByText("Cuenta cerrada")).toBeTruthy();
    expect(screen.getByText(/Cambio a devolver/).textContent).toContain("$32.400");
  });
});
