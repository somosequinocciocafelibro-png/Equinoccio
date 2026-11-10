import { describe, expect, test } from "vitest";
import { AppError } from "@/server/errors";
import { safe } from "@/server/safe";

describe("safe", () => {
  test("devuelve ok junto con el resultado", async () => {
    expect(await safe(async () => ({ ticketId: "t1" }))).toEqual({ ok: true, ticketId: "t1" });
  });

  test("convierte un AppError en el código del error", async () => {
    expect(
      await safe(async () => {
        throw new AppError("DAY_CLOSED");
      }),
    ).toEqual({ ok: false, error: "DAY_CLOSED" });
  });

  test("deja pasar cualquier otro error", async () => {
    await expect(
      safe(async () => {
        throw new Error("falló la base de datos");
      }),
    ).rejects.toThrow("falló la base de datos");
  });
});
