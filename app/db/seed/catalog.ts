import type { Db } from "../../src/server/db";

export const TABLES = [
  { id: "luna-1", name: "Mesa 1", salon: "Luna", capacity: null },
  { id: "luna-2", name: "Mesa 2", salon: "Luna", capacity: null },
  { id: "luna-3", name: "Mesa 3", salon: "Luna", capacity: null },
  { id: "luna-barra", name: "Barra", salon: "Luna", capacity: 2 },
  { id: "eq-1", name: "Mesa 1", salon: "Equinoccio", capacity: null },
  { id: "eq-2", name: "Mesa 2", salon: "Equinoccio", capacity: null },
  { id: "eq-3", name: "Mesa 3", salon: "Equinoccio", capacity: null },
  { id: "eq-4", name: "Mesa 4", salon: "Equinoccio", capacity: null },
  { id: "sol-1", name: "Mesa 1", salon: "Sol", capacity: null },
  { id: "sol-2", name: "Mesa 2", salon: "Sol", capacity: null },
  { id: "sol-3", name: "Mesa 3", salon: "Sol", capacity: null },
  { id: "sol-barra", name: "Barra", salon: "Sol", capacity: 2 },
] as const;

export const EXTRAS = [
  { id: "vainilla", name: "Vainilla", delta: 500 },
  { id: "caramelo", name: "Caramelo", delta: 0 },
] as const;

type P = [id: string, name: string, category: string, price: number];
export const PRODUCTS: P[] = [
  ["espresso", "Espresso", "Café", 4000],
  ["americano", "Americano", "Café", 4500],
  ["capuchino", "Capuchino", "Café", 9000],
  ["latte", "Latte", "Café", 8000],
  ["mini-latte", "Mini Latte", "Café", 6000],
  ["mocca", "Mocca", "Café", 10500],
  ["macchiato-caramelo", "Macchiato caramelo", "Café", 7000],
  ["affogato", "Affogato", "Café", 11000],
  ["chocolate", "Chocolate", "Café", 10000],
  ["ice-latte", "Ice Latte", "Fríos", 8500],
  ["cold-brew-chocolate", "Cold Brew + Chocolate", "Fríos", 8000],
  ["te-frutos-rojos", "Té frutos rojos", "Té y aromáticas", 8000],
  ["te-marea-de-luna", "Té Marea de Luna", "Té y aromáticas", 8000],
  ["aromatica-hierbabuena", "Aromática hierbabuena", "Té y aromáticas", 6000],
  ["aromatica-frutos-rojos", "Aromática frutos rojos", "Té y aromáticas", 8000],
  ["aromatica-maracuya", "Aromática maracuyá", "Té y aromáticas", 8000],
  ["aromatica-sandia", "Aromática sandía", "Té y aromáticas", 6000],
  ["soda-nectar-solar", "Soda Néctar Solar", "Sodas", 10000],
  ["soda-bosque-tropical", "Soda Bosque Tropical", "Sodas", 10000],
  ["soda-frutos-amarillos", "Soda frutos amarillos", "Sodas", 10000],
  ["soda-frutos-rojos", "Soda frutos rojos", "Sodas", 10000],
  ["croissant-frutos-rojos", "Croissant frutos rojos", "Panadería", 6500],
  ["croissant-chocolate", "Croissant chocolate", "Panadería", 6500],
  ["crookie", "Crookie", "Panadería", 6500],
  ["rollo-de-canela", "Rollo de canela", "Panadería", 6500],
  ["palito-chocolate", "Palito de chocolate", "Panadería", 6500],
  ["palito-queso-crema", "Palito queso crema", "Panadería", 6500],
  ["palito-bocadillo", "Palito de bocadillo", "Panadería", 4000],
  ["palito-queso-bocadillo", "Palito queso + bocadillo", "Panadería", 3500],
  ["almojabana", "Almojábana", "Panadería", 2000],
  ["pastel-manzana", "Pastel de manzana", "Pasteles y salados", 6500],
  ["pastel-espinaca-ricota", "Pastel espinaca y ricota", "Pasteles y salados", 6500],
  ["pastel-ricotta", "Pastel ricotta", "Pasteles y salados", 4500],
  ["pastel-carne-ranchero", "Pastel carne ranchero", "Pasteles y salados", 6500],
  ["pastel-pollo", "Pastel de pollo", "Pasteles y salados", 4500],
  ["pastel-almendras", "Pastel de almendras", "Pasteles y salados", 6500],
  ["pastel-arequipe-pequeno", "Pastel arequipe pequeño", "Pasteles y salados", 2000],
  ["torta-zanahoria", "Torta de zanahoria", "Pasteles y salados", 6000],
  ["pollo-carbonara", "Pollo carbonara", "Pasteles y salados", 13000],
  ["malteada-vainilla", "Malteada de vainilla", "Malteadas", 8000],
  ["malteada-fresa", "Malteada de fresa", "Malteadas", 8000],
  ["malteada-arequipe", "Malteada de arequipe", "Malteadas", 8000],
  ["malteada-chocolate", "Malteada de chocolate", "Malteadas", 8000],
];

/** Carga salones, mesas, extras y catálogo iniciales. Se ejecuta una sola vez sobre una base vacía. */
export async function seedCatalog(db: Db): Promise<void> {
  await db.tx(async (t) => {
    let sort = 0;
    for (const m of TABLES) {
      await t.query(
        `insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ($1, $2, $3, $4, false, $5)`,
        [m.id, m.name, m.salon, m.capacity, ++sort],
      );
    }
    await t.query(
      `insert into dining_tables (id, name, salon, capacity, is_takeout, sort) values ('llevar', 'Para llevar', null, null, true, $1)`,
      [++sort],
    );
    for (const e of EXTRAS) {
      await t.query(`insert into extras (id, name, delta) values ($1, $2, $3)`, [e.id, e.name, e.delta]);
    }
    let order = 0;
    for (const [id, name, category, price] of PRODUCTS) {
      await t.query(`insert into products (id, name, category, price, sort) values ($1, $2, $3, $4, $5)`, [
        id,
        name,
        category,
        price,
        ++order,
      ]);
    }
  });
}
