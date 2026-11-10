import { describe, expect, test } from "vitest";
import { KNOWN_ERROR_CODES, errorMessage } from "@/lib/messages";

describe("errorMessage", () => {
  test("cada código conocido tiene su propio texto en español", () => {
    const generico = errorMessage("CODIGO_DESCONOCIDO");
    for (const code of KNOWN_ERROR_CODES) {
      const texto = errorMessage(code);
      expect(texto.length).toBeGreaterThan(5);
      expect(texto).not.toBe(generico);
    }
  });

  test("un código desconocido da un mensaje genérico", () => {
    expect(errorMessage("CODIGO_DESCONOCIDO")).toBe("Algo salió mal. Inténtalo de nuevo.");
  });

  test("dice que el día está cerrado", () => {
    expect(errorMessage("DAY_CLOSED")).toMatch(/cerrado/);
  });
});
