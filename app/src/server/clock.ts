/** Reloj del servidor en un solo lugar, para no llamar Date.now() directamente dentro de las pantallas. */
export function nowMs(): number {
  return Date.now();
}
