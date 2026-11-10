import { describe, expect, test } from "vitest";
import { matchProducts, parseSearch } from "@/lib/parseSearch";

describe("parseSearch", () => {
  test.each(["3 latte", "3*latte", "3x latte", "3 × latte"])("'%s' agrega tres lattes", (q) => {
    expect(parseSearch(q)).toEqual({ qty: 3, text: "latte" });
  });

  test("sin cantidad vale uno", () => {
    expect(parseSearch("latte")).toEqual({ qty: 1, text: "latte" });
  });

  test("más de dos dígitos o cero no es una cantidad", () => {
    expect(parseSearch("100 latte")).toEqual({ qty: 1, text: "100 latte" });
    expect(parseSearch("0 latte")).toEqual({ qty: 1, text: "0 latte" });
  });

  test("un número solo se trata como texto", () => {
    expect(parseSearch("2")).toEqual({ qty: 1, text: "2" });
  });
});

describe("matchProducts", () => {
  const products = [
    { id: "capuchino", name: "Capuchino", category: "Café", price: 9000 },
    { id: "sandia", name: "Aromática sandía", category: "Té y aromáticas", price: 6000 },
    { id: "latte", name: "Latte", category: "Café", price: 8000 },
  ];

  test("ignora tildes y mayúsculas", () => {
    expect(matchProducts(products, "SANDIA", "Todos").map((p) => p.id)).toEqual(["sandia"]);
    expect(matchProducts(products, "capuch", "Todos").map((p) => p.id)).toEqual(["capuchino"]);
  });

  test("filtra por categoría y conserva el orden", () => {
    expect(matchProducts(products, "", "Café").map((p) => p.id)).toEqual(["capuchino", "latte"]);
  });

  test("sin coincidencias devuelve una lista vacía", () => {
    expect(matchProducts(products, "zzz", "Todos")).toEqual([]);
  });
});
