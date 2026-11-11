import { expect, test } from "@playwright/test";

const usuario = process.env.E2E_USER;
const password = process.env.E2E_PASSWORD;

test.skip(
  !process.env.E2E_BASE_URL || !usuario || !password,
  "Define E2E_BASE_URL, E2E_USER y E2E_PASSWORD (usuario de caja de un entorno de pruebas).",
);

// Deja una venta de prueba en la base del entorno: úsalo solo contra un entorno de pruebas.
test("venta completa: dos productos, servicio, pago dividido y cuenta cerrada", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Nombre").fill(usuario as string);
  await page.getByLabel("Contraseña").fill(password as string);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/mesas$/);

  await page.goto("/mesas/luna-3");
  const buscar = page.getByLabel(/Buscar producto/);
  await buscar.fill("latte");
  await buscar.press("Enter");
  await expect(page.getByText("Subtotal")).toBeVisible();
  await buscar.fill("espresso");
  await buscar.press("Enter");

  await page.getByRole("button", { name: "Cobrar" }).click();
  await expect(page.getByLabel(/Servicio voluntario/)).toBeChecked();
  // Latte $8.000 + Espresso $4.000 = $12.000; servicio 10% = $1.200; total $13.200 (precios del catálogo inicial).
  await expect(page.locator(".kv", { hasText: "Total a pagar" })).toContainText("$13.200");

  await page.getByRole("button", { name: "Bold" }).click();
  await page.getByLabel("Monto de este pago").fill("5000");
  await page.getByRole("button", { name: "Registrar pago" }).click();
  await expect(page.getByText("Saldo pendiente").locator("xpath=following-sibling::*[1]")).toHaveText("$8.200");

  await page.getByRole("button", { name: "Efectivo" }).click();
  await page.getByLabel(/Recibe del cliente/).fill("10000");
  await page.getByRole("button", { name: "Registrar pago" }).click();

  await expect(page.getByText("Cuenta cerrada")).toBeVisible();
  await expect(page.getByText(/Cambio a devolver/)).toContainText("$1.800");
});
