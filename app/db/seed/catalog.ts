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

/**
 * Adiciones, en dos tarifas: +$500 (miel, panela, vainilla, caramelo) y +$1.000 (arequipe, cocoa, chocolate,
 * leche condensada, chantillí y dulces o siropes como el de cereza). La de Cold Brew (+$2.000) es propia de ese producto.
 */
export const EXTRAS = [
  { id: "miel", name: "Miel", delta: 500 },
  { id: "panela", name: "Panela", delta: 500 },
  { id: "vainilla", name: "Vainilla", delta: 500 },
  { id: "caramelo", name: "Caramelo", delta: 500 },
  { id: "arequipe", name: "Arequipe", delta: 1000 },
  { id: "cocoa", name: "Cocoa", delta: 1000 },
  { id: "chocolate", name: "Chocolate", delta: 1000 },
  { id: "leche-condensada", name: "Leche condensada", delta: 1000 },
  { id: "chantilli", name: "Chantillí", delta: 1000 },
  { id: "dulce-cereza", name: "Dulce de cereza o sirope dulce", delta: 1000 },
  { id: "leche-espuma-frutos-soda", name: "Leche espuma / frutos / soda", delta: 2000 },
] as const;

/** [id, nombre, categoría, precio, activo?]. El orden de la lista es el de la carta. Activo por defecto. */
type P = [id: string, name: string, category: string, price: number, active?: boolean];
export const PRODUCTS: P[] = [
  ["espresso", "Espresso", "Café caliente", 4000],
  ["americano", "Americano", "Café caliente", 4500],
  ["macchiato", "Macchiato", "Café caliente", 6000],
  ["flat-white", "Flat White", "Café caliente", 7000],
  ["latte", "Latte", "Café caliente", 8000],
  ["capuchino", "Cappuccino", "Café caliente", 9000],
  ["mocca", "Mocha Equinoccio", "Café caliente", 10000],
  ["affogato", "Affogato", "Café caliente", 11000],
  ["chocolate", "Hot Chocolate", "Chocolate caliente", 10000],
  ["cold-brew", "Cold Brew", "Café frío", 8000],
  ["ice-latte", "Iced Latte", "Café frío", 8000],
  ["iced-caramel-latte", "Iced Caramel Latte", "Café frío", 8000],
  ["iced-mocha", "Iced Mocha Equinoccio", "Café frío", 10000],
  ["iced-macchiaramelo", "Iced Macchiaramelo Equinoccio", "Café frío", 10000],
  ["fuego-de-equinoccio", "Fuego de Equinoccio", "Café frío", 10000],
  ["eclipse-de-equinoccio", "Eclipse de Equinoccio", "Café frío", 10000],
  ["sol-de-media-noche", "Sol de Media Noche", "Café frío", 10000],
  ["malteada-vainilla", "Malteada de vainilla", "Malteadas", 10000],
  ["malteada-arequipe", "Malteada de arequipe", "Malteadas", 10000],
  ["malteada-chocolate", "Malteada de chocolate", "Malteadas", 10000],
  ["soda-nectar-solar", "Soda Néctar Solar", "Sodas frutales", 10000],
  ["soda-bosque-tropical", "Soda Bosque Tropical", "Sodas frutales", 10000],
  ["soda-frutos-rojos", "Soda Pasión", "Sodas frutales", 10000],
  ["soda-eclipse-azul", "Soda Eclipse Azul", "Sodas frutales", 10000],
  ["te-marea-de-luna", "Marea de Luna", "Tés", 8000],
  ["te-rayo-de-sol", "Rayo de Sol", "Tés", 8000],
  ["te-luz-de-primavera", "Luz de Primavera", "Tés", 8000],
  ["aromatica-manzanilla", "Aromática de manzanilla", "Aromáticas", 6000],
  ["aromatica-cidron", "Aromática de cidrón", "Aromáticas", 6000],
  ["aromatica-toronjil", "Aromática de toronjil", "Aromáticas", 6000],
  ["aromatica-hierbabuena", "Aromática de hierbabuena", "Aromáticas", 6000],
  ["aromatica-limoncillo", "Aromática de limoncillo", "Aromáticas", 6000],
  ["aromatica-maracuya", "Aromática de maracuyá", "Aromáticas", 6000],
  ["aromatica-flor-de-jamaica", "Aromática de flor de jamaica", "Aromáticas", 6000],
  ["croissant-chocolate", "Croissant bicolor chocolate mantequilla", "Pastelería y panadería", 6500],
  ["croissant-almendras", "Croissant de almendras", "Pastelería y panadería", 6500],
  ["croissant-frutos-rojos", "Croissant bicolor frutos rojos", "Pastelería y panadería", 6500],
  ["rollo-de-canela", "Rollo de canela", "Pastelería y panadería", 6500],
  ["crookie", "Crookie", "Pastelería y panadería", 6500],
  ["mini-pan-de-bono", "Mini Pan de Bono", "Pastelería y panadería", 2000],
  ["palito-queso-crema", "Palito queso crema", "Pastelería y panadería", 6500],
  ["palito-queso-crema-pequeno", "Palito queso crema pequeño", "Pastelería y panadería", 3500],
  ["almojabana", "Mini-almojábana", "Pastelería y panadería", 2000],
  ["flauta-chocolate", "Flauta de chocolate", "Pastelería y panadería", 6500],
  ["pollo-carbonara", "Pastel de pollo carbonara", "Pastelería y panadería", 6500],
  ["pastel-espinaca-ricota", "Pastel de espinaca y queso ricotta", "Pastelería y panadería", 6500],
  ["pastel-espinaca-ricota-pequeno", "Pastel de espinaca y queso ricotta pequeño", "Pastelería y panadería", 4000],
  ["pastel-carne-ranchero", "Pastel de carne ranchero", "Pastelería y panadería", 6500],
  ["pan-chocolate-mantequilla", "Pan de chocolate mantequilla", "Pastelería y panadería", 3500],
  ["pastel-manzana", "Pastel de manzana", "Pastelería y panadería", 6500],
  ["pastel-pollo", "Pastel de pollo", "Pastelería y panadería", 5000],
  ["croissant-multicereal", "Croissant multicereal mantequilla", "Pastelería y panadería", 3500],
  ["pastel-arequipe-pequeno", "Mini roscón de arequipe", "Pastelería y panadería", 2000],
  ["palito-queso-bocadillo", "Palito de bocadillo y queso", "Pastelería y panadería", 6500],
  ["pastel-arequipe", "Pastel de arequipe", "Pastelería y panadería", 5500],
  // Productos que ya no están en la carta. Se conservan desactivados para que el historial y la importación del Excel
  // sigan funcionando, y se pueden reactivar desde Catálogo.
  ["mini-latte", "Mini Latte", "Café caliente", 6000, false],
  ["macchiato-caramelo", "Macchiato caramelo", "Café caliente", 7000, false],
  ["cold-brew-chocolate", "Cold Brew + Chocolate", "Café frío", 8000, false],
  ["malteada-fresa", "Malteada de fresa", "Malteadas", 8000, false],
  ["soda-frutos-amarillos", "Soda frutos amarillos", "Sodas frutales", 10000, false],
  ["te-frutos-rojos", "Té frutos rojos", "Tés", 8000, false],
  ["aromatica-frutos-rojos", "Aromática frutos rojos", "Aromáticas", 8000, false],
  ["aromatica-sandia", "Aromática sandía", "Aromáticas", 6000, false],
  ["palito-chocolate", "Palito de chocolate", "Pastelería y panadería", 6500, false],
  ["palito-bocadillo", "Palito de bocadillo", "Pastelería y panadería", 4000, false],
  ["pastel-ricotta", "Pastel ricotta", "Pastelería y panadería", 4500, false],
  ["pastel-almendras", "Pastel de almendras", "Pastelería y panadería", 6500, false],
  ["torta-zanahoria", "Torta de zanahoria", "Pastelería y panadería", 6000, false],
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
    for (const [id, name, category, price, active = true] of PRODUCTS) {
      await t.query(`insert into products (id, name, category, price, active, sort) values ($1, $2, $3, $4, $5, $6)`, [
        id,
        name,
        category,
        price,
        active,
        ++order,
      ]);
    }
  });
}
