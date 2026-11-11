// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TicketScreen } from "@/app/mesas/[tableId]/ticket-screen";
import { toggleExtraAction } from "@/app/mesas/actions";
import { line, ticket } from "../helpers/ticket";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/cierre/actions", () => ({ voidTicketAction: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/app/mesas/actions", () => ({
  addLineAction: vi.fn(async () => ({ ok: true, ticketId: "t1" })),
  setQtyAction: vi.fn(async () => ({ ok: true })),
  toggleExtraAction: vi.fn(async () => ({ ok: true })),
  setServiceAction: vi.fn(async () => ({ ok: true })),
  addPaymentAction: vi.fn(async () => ({ ok: true, paymentId: "p1", change: 0, closed: false })),
  removePaymentAction: vi.fn(async () => ({ ok: true })),
}));

const table = { id: "luna-1", name: "Mesa 1", salon: "Luna", capacity: null, isTakeout: false, displayName: "Luna · Mesa 1" };
const extras = [
  { id: "miel", name: "Miel", delta: 500 },
  { id: "vainilla", name: "Vainilla", delta: 500 },
  { id: "arequipe", name: "Arequipe", delta: 1000 },
  { id: "cold", name: "Leche espuma / frutos / soda", delta: 2000 },
];
const conLatte = (extrasLinea: { id: string; name: string; delta: number }[] = []) =>
  ticket({ id: "t1", lines: [line({ id: "l1", name: "Latte", qty: 1, unitPrice: 8000, extras: extrasLinea })] });
const pantalla = (t = conLatte()) => <TicketScreen table={table} ticket={t} products={[]} extras={extras} pct={10} />;

beforeEach(() => {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("adiciones por tarifa", () => {
  test("cada línea tiene un botón Adiciones y las opciones no se ven hasta abrirlo", () => {
    render(pantalla());
    expect(screen.getByRole("button", { name: /Adiciones/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Miel" })).toBeNull();
  });

  test("al abrirlo muestra cada tarifa con sus adiciones, de menor a mayor", async () => {
    render(pantalla());
    await userEvent.click(screen.getByRole("button", { name: /Adiciones/ }));
    const grupos = screen.getAllByTestId("adicion-grupo");
    expect(grupos.map((g) => within(g).getByTestId("adicion-tarifa").textContent)).toEqual(["+$500", "+$1.000", "+$2.000"]);
    expect(within(grupos[0]).getAllByRole("button").map((b) => b.textContent)).toEqual(["Miel", "Vainilla"]);
    expect(within(grupos[1]).getAllByRole("button").map((b) => b.textContent)).toEqual(["Arequipe"]);
    expect(within(grupos[2]).getAllByRole("button").map((b) => b.textContent)).toEqual(["Leche espuma / frutos / soda"]);
  });

  test("marcar una adición avisa al servidor y el panel sigue abierto para elegir otra", async () => {
    render(pantalla());
    await userEvent.click(screen.getByRole("button", { name: /Adiciones/ }));
    await userEvent.click(screen.getByRole("button", { name: "Miel" }));
    expect(toggleExtraAction).toHaveBeenCalledWith({ lineId: "l1", extraId: "miel" });
    await vi.waitFor(() => expect((screen.getByRole("button", { name: "Vainilla" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByRole("button", { name: "Vainilla" })).toBeTruthy();
  });

  test("las adiciones elegidas se ven marcadas, en la línea y en el contador", async () => {
    render(pantalla(conLatte([{ id: "miel", name: "Miel", delta: 500 }, { id: "arequipe", name: "Arequipe", delta: 1000 }])));
    expect(screen.getByRole("button", { name: "Adiciones (2)" })).toBeTruthy();
    expect(screen.getByText(/Miel, Arequipe/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Adiciones/ }));
    expect(screen.getByRole("button", { name: "Miel" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Vainilla" }).getAttribute("aria-pressed")).toBe("false");
  });

  test("el precio de la línea incluye las adiciones", () => {
    render(pantalla(conLatte([{ id: "miel", name: "Miel", delta: 500 }, { id: "arequipe", name: "Arequipe", delta: 1000 }])));
    expect(screen.getAllByText("$9.500").length).toBeGreaterThan(0); // 8.000 + 500 + 1.000
  });
});
