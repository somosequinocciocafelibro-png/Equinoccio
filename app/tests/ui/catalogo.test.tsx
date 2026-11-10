// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { saveProductAction, saveServicePctAction } from "@/app/catalogo/actions";
import { CatalogEditor } from "@/app/catalogo/catalog-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/catalogo/actions", () => ({
  saveProductAction: vi.fn(async () => ({ ok: true, id: "p1" })),
  saveExtraAction: vi.fn(async () => ({ ok: true, id: "x1" })),
  saveTableAction: vi.fn(async () => ({ ok: true, id: "m1" })),
  saveServicePctAction: vi.fn(async () => ({ ok: true })),
}));

const data = {
  pct: 10,
  products: [{ id: "latte", name: "Latte", category: "Café", price: 8000, active: true }],
  extras: [{ id: "vainilla", name: "Vainilla", delta: 500, active: true }],
  tables: [{ id: "luna-1", name: "Mesa 1", salon: "Luna", capacity: null, isTakeout: false, active: true, displayName: "Luna · Mesa 1" }],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CatalogEditor", () => {
  test("desactivar un producto lo guarda como inactivo y no existe un botón para borrarlo", async () => {
    render(<CatalogEditor {...data} />);
    await userEvent.click(screen.getByLabelText("Activo Latte"));
    expect(saveProductAction).toHaveBeenCalledWith({ id: "latte", name: "Latte", category: "Café", price: 8000, active: false });
    expect(screen.queryByRole("button", { name: /borrar|eliminar/i })).toBeNull();
  });

  test("cambiar el precio guarda al salir del campo", async () => {
    render(<CatalogEditor {...data} />);
    const precio = screen.getByLabelText("Precio Latte");
    await userEvent.clear(precio);
    await userEvent.type(precio, "9000");
    await userEvent.tab();
    expect(saveProductAction).toHaveBeenCalledWith({ id: "latte", name: "Latte", category: "Café", price: 9000, active: true });
  });

  test("agrega un producto nuevo con nombre, categoría y precio", async () => {
    render(<CatalogEditor {...data} />);
    await userEvent.type(screen.getByLabelText("Nombre del producto nuevo"), "Brownie");
    await userEvent.type(screen.getByLabelText("Categoría del producto nuevo"), "Postres");
    await userEvent.type(screen.getByLabelText("Precio del producto nuevo"), "5000");
    await userEvent.click(screen.getByRole("button", { name: "Agregar producto" }));
    expect(saveProductAction).toHaveBeenCalledWith({ name: "Brownie", category: "Postres", price: 5000, active: true });
  });

  test("guarda el porcentaje de servicio", async () => {
    render(<CatalogEditor {...data} />);
    const pct = screen.getByLabelText("Porcentaje de servicio");
    await userEvent.clear(pct);
    await userEvent.type(pct, "12");
    await userEvent.tab();
    expect(saveServicePctAction).toHaveBeenCalledWith({ pct: 12 });
  });

  test("muestra en español el error del servidor", async () => {
    vi.mocked(saveProductAction).mockResolvedValueOnce({ ok: false, error: "NAME_TAKEN" });
    render(<CatalogEditor {...data} />);
    await userEvent.type(screen.getByLabelText("Nombre del producto nuevo"), "Latte");
    await userEvent.type(screen.getByLabelText("Precio del producto nuevo"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Agregar producto" }));
    expect(await screen.findByText("Ya existe un producto con ese nombre.")).toBeTruthy();
  });
});
