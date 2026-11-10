import { describe, expect, test } from "vitest";
import { rangeFor } from "@/lib/ranges";

describe("rangeFor", () => {
  const today = "2026-11-10";

  test("hoy es solo el día de hoy", () => {
    expect(rangeFor("hoy", today)).toEqual({ from: "2026-11-10", to: "2026-11-10" });
  });

  test("7 y 30 días incluyen hoy", () => {
    expect(rangeFor("7", today)).toEqual({ from: "2026-11-04", to: "2026-11-10" });
    expect(rangeFor("30", today)).toEqual({ from: "2026-10-12", to: "2026-11-10" });
  });

  test("cruza el cambio de mes y de año", () => {
    expect(rangeFor("7", "2026-01-03")).toEqual({ from: "2025-12-28", to: "2026-01-03" });
  });

  test("todo empieza en el año 2000, una fecha que Postgres entiende", () => {
    expect(rangeFor("todo", today)).toEqual({ from: "2000-01-01", to: "2026-11-10" });
  });

  test("un valor desconocido cae en hoy", () => {
    expect(rangeFor("raro", today)).toEqual({ from: today, to: today });
  });
});
