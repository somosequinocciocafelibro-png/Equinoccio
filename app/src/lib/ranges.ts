export type RangeKey = "hoy" | "7" | "30" | "todo";

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "7", label: "7 días" },
  { key: "30", label: "30 días" },
  { key: "todo", label: "Todo" },
];

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Rango de días (inclusive) de los reportes. Un valor desconocido equivale a "hoy". */
export function rangeFor(key: string, today: string): { from: string; to: string } {
  if (key === "7") return { from: addDays(today, -6), to: today };
  if (key === "30") return { from: addDays(today, -29), to: today };
  if (key === "todo") return { from: "2000-01-01", to: today };
  return { from: today, to: today };
}
