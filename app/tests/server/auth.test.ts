import { describe, expect, test } from "vitest";
import { authorize, canAccess, type Action, type Role } from "@/server/auth";

const ACTIONS: Action[] = ["sell", "charge", "closeDay", "viewReports", "editCatalog", "void", "reopenDay"];

describe("canAccess", () => {
  test("caja vende, cobra y cierra el día, y nada más", () => {
    const permitidas = ACTIONS.filter((a) => canAccess("caja", a));
    expect(permitidas).toEqual(["sell", "charge", "closeDay"]);
  });

  test("admin puede todo", () => {
    expect(ACTIONS.every((a) => canAccess("admin", a))).toBe(true);
  });

  test("sin rol no se puede nada", () => {
    expect(ACTIONS.some((a) => canAccess(null, a))).toBe(false);
  });
});

describe("authorize", () => {
  test("sin sesión rechaza con UNAUTHENTICATED", () => {
    expect(() => authorize(null, "admin", "sell")).toThrowError(expect.objectContaining({ code: "UNAUTHENTICATED" }));
  });

  test("con sesión pero sin rol o sin permiso rechaza con FORBIDDEN", () => {
    expect(() => authorize({ userId: "u1" }, null, "sell")).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => authorize({ userId: "u1" }, "caja", "viewReports")).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  test("devuelve el usuario y su rol cuando tiene permiso", () => {
    const role: Role = "admin";
    expect(authorize({ userId: "u1" }, role, "reopenDay")).toEqual({ userId: "u1", role });
  });
});
