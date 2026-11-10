// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Ticket } from "@/domain/types";
import { useOnline } from "@/lib/useOnline";
import { TicketScreen } from "@/app/mesas/[tableId]/ticket-screen";
import { addLineAction } from "@/app/mesas/actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/mesas/actions", () => ({
  addLineAction: vi.fn(async () => ({ ok: true, ticketId: "t1" })),
  setQtyAction: vi.fn(async () => ({ ok: true })),
  toggleExtraAction: vi.fn(async () => ({ ok: true })),
}));

const table = { id: "luna-1", name: "Mesa 1", salon: "Luna", capacity: null, isTakeout: false, displayName: "Luna · Mesa 1" };
const products = [
  { id: "latte", name: "Latte", category: "Café", price: 8000 },
  { id: "espresso", name: "Espresso", category: "Café", price: 4000 },
];
const extras = [{ id: "vainilla", name: "Vainilla", delta: 500 }];
const props = { table, ticket: null as Ticket | null, products, extras, pct: 10 };

let onLine = true;
beforeEach(() => {
  onLine = true;
  vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => onLine);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const goOffline = () => {
  onLine = false;
  act(() => {
    window.dispatchEvent(new Event("offline"));
  });
};

describe("useOnline", () => {
  test("sigue los eventos online y offline del navegador", () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
    goOffline();
    expect(result.current).toBe(false);
    onLine = true;
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });
});

describe("TicketScreen", () => {
  test("sin conexión avisa y deshabilita los botones de venta", () => {
    onLine = false;
    render(<TicketScreen {...props} />);
    expect(screen.getByText(/Sin conexión/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Latte/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("escribir '3 latte' y Enter agrega tres lattes", async () => {
    render(<TicketScreen {...props} />);
    await userEvent.type(screen.getByLabelText(/Buscar producto/), "3 latte{Enter}");
    expect(addLineAction).toHaveBeenCalledWith({ tableId: "luna-1", ticketId: null, productId: "latte", qty: 3 });
  });

  test("tocar un producto lo agrega una vez", async () => {
    render(<TicketScreen {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /Espresso/ }));
    expect(addLineAction).toHaveBeenCalledWith({ tableId: "luna-1", ticketId: null, productId: "espresso", qty: 1 });
  });
});
