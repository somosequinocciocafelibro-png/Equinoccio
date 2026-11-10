import { defineConfig } from "@playwright/test";

// Prueba de humo contra un entorno desplegado de pruebas (nunca contra la caja real).
// Variables: E2E_BASE_URL, E2E_EMAIL y E2E_PASSWORD (un usuario de caja). PW_CHROMIUM es opcional.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL,
    launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined, args: ["--no-sandbox"] },
  },
});
