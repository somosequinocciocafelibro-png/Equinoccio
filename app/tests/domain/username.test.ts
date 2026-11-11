import { describe, expect, test } from "vitest";
import { loginEmail, normalizeUsername } from "@/lib/username";

const T = "somosequinocciocafelibro+{usuario}@gmail.com";

describe("normalizeUsername", () => {
  test("ignora mayúsculas, tildes y espacios", () => {
    expect(normalizeUsername("  Richard ")).toBe("richard");
    expect(normalizeUsername("María")).toBe("maria");
    expect(normalizeUsername("Ana Maria")).toBe("anamaria");
  });
  test("deja solo letras y números", () => {
    expect(normalizeUsername("c.yepes+x@y")).toBe("cyepesxy");
  });
});

describe("loginEmail", () => {
  test("convierte el usuario en el correo interno", () => {
    expect(loginEmail("Carolina", T)).toBe("somosequinocciocafelibro+carolina@gmail.com");
  });
  test("si escriben un correo completo lo respeta", () => {
    expect(loginEmail("Alguien@Correo.com", T)).toBe("alguien@correo.com");
  });
  test("usuario vacío no genera correo", () => {
    expect(loginEmail("  ", T)).toBeNull();
    expect(loginEmail("***", T)).toBeNull();
  });
});
