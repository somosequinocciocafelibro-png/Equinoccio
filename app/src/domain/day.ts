const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Día de venta: fecha local de Bogotá (YYYY-MM-DD) de un instante ISO. */
export function businessDay(iso: string): string {
  return fmt.format(new Date(iso));
}
