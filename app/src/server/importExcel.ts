import * as XLSX from "xlsx";
import { normalize } from "@/lib/parseSearch";
import type { PaymentMedio } from "@/domain/types";
import type { Db } from "./db";

/* ---------- lectura del libro ---------- */

export interface ImportLine {
  name: string;
  qty: number;
  unitPrice: number;
  row: number;
}

export interface ImportTicket {
  /** Identificador estable: imp-AAAAMMDD-N (fecha del encabezado y orden dentro del día). */
  key: string;
  headerDate: string;
  /** Fecha escrita en "Total ventas dd/mm/aaaa" del mismo día, si existe. */
  declaredDate: string | null;
  mesaLabel: string;
  lines: ImportLine[];
  declaredTotal: number | null;
  medioLabel: string | null;
  firstRow: number;
  /** Tuvo filas descartadas con valor: la cuenta no es confiable. */
  dirty: boolean;
}

export interface ParseResult {
  tickets: ImportTicket[];
  discarded: { row: number; reason: string }[];
}

const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const TOTAL_VENTAS_RE = /^total ventas\s+(\d{1,2}\/\d{1,2}\/\d{4})/i;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const padDate = (s: string) => s.split("/").map((p, i) => (i < 2 ? p.padStart(2, "0") : p)).join("/");

function parseMoney(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  const t = str(v).replace(/[$\s,]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function dateCell(v: unknown): string | null {
  if (typeof v === "number" && v > 36526 && v < 60000) {
    const d = XLSX.SSF.parse_date_code(v);
    return padDate(`${d.d}/${d.m}/${d.y}`);
  }
  const t = str(v);
  return DATE_RE.test(t) ? padDate(t) : null;
}

/** Recorre las filas de la primera hoja y arma una cuenta por cada bloque de mesa. No toca la base de datos. */
export function parseRows(rows: unknown[][]): ParseResult {
  const tickets: ImportTicket[] = [];
  const discarded: { row: number; reason: string }[] = [];
  let headerDate = "";
  let counter = 0;
  let dayTickets: ImportTicket[] = [];
  let cur: ImportTicket | null = null;

  const close = () => {
    if (cur && (cur.lines.length > 0 || cur.dirty || cur.declaredTotal !== null)) {
      tickets.push(cur);
      dayTickets.push(cur);
    }
    cur = null;
  };
  const discard = (row: number, reason: string, withValue: boolean) => {
    discarded.push({ row, reason });
    if (withValue && cur) cur.dirty = true;
  };

  rows.forEach((raw, i) => {
    const row = i + 1;
    const A = str(raw[0]);
    const B = str(raw[1]);
    const C = raw[2];
    const D = raw[3];
    const E = parseMoney(raw[4]);
    const markers = [5, 6, 7].map((k) => str(raw[k])).filter(Boolean);

    if (normalize(str(C)) === "unidad") return; // encabezado de columnas

    const header = dateCell(raw[0]);
    if (header && B === "" && E === null) {
      close();
      headerDate = header;
      counter = 0;
      dayTickets = [];
      return;
    }
    const tv = A.match(TOTAL_VENTAS_RE);
    if (tv) {
      close();
      for (const t of dayTickets) t.declaredDate = padDate(tv[1]);
      return;
    }
    if (/^(mesa|llevar)\b/.test(normalize(A))) {
      close();
      counter += 1;
      const ymd = headerDate ? headerDate.split("/").reverse().join("") : "sinfecha";
      cur = {
        key: `imp-${ymd}-${counter}`,
        headerDate,
        declaredDate: null,
        mesaLabel: A,
        lines: [],
        declaredTotal: null,
        medioLabel: null,
        firstRow: row,
        dirty: false,
      };
    }

    const labelIsTotal = [A, B, str(C), str(D)].some((x) => normalize(x) === "total");
    const unlabeledTotal =
      cur !== null && (cur as ImportTicket).lines.length > 0 && A === "" && B === "" && str(C) === "" && str(D) === "" && E !== null && E > 0;
    if (labelIsTotal || unlabeledTotal) {
      if (!cur) {
        discard(row, "total sin cuenta", false);
        return;
      }
      const t = cur as ImportTicket;
      t.declaredTotal = E;
      if (!t.medioLabel && markers[0]) t.medioLabel = markers[0];
      close();
      return;
    }
    if ([A, B, str(C), str(D)].every((x) => x === "")) {
      if (E === 0) discard(row, "fila con $0.00", false);
      else if (E !== null) discard(row, "total sin cuenta", false);
      return;
    }

    if (!cur) {
      discard(row, "fila fuera de una mesa", false);
      return;
    }
    const t = cur as ImportTicket;
    if (!B) {
      discard(row, "producto sin nombre", (E ?? 0) > 0);
      return;
    }
    const qty = typeof C === "number" ? C : Number(str(C));
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      discard(row, `cantidad inválida (${str(C) || "vacía"})`, true);
      return;
    }
    if (E === null || E <= 0) {
      discard(row, "producto sin valor", true);
      return;
    }
    const unit = parseMoney(D) ?? Math.round(E / qty);
    if (unit * qty !== E) {
      discard(row, "valor unitario por cantidad no cuadra con el valor total", true);
      return;
    }
    t.lines.push({ name: B, qty, unitPrice: unit, row });
    if (!t.medioLabel && markers[0]) t.medioLabel = markers[0];
  });
  close();
  return { tickets, discarded };
}

export function parseWorkbook(path: string): ParseResult {
  const wb = XLSX.readFile(path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return parseRows(XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" }));
}

/* ---------- equivalencias de nombres ---------- */

export interface Equivalence {
  productId: string;
  extraId?: string;
}
export type Equivalences = Record<string, Equivalence>;

export const nameKey = (s: string) => normalize(s).replace(/\s+/g, " ");

/** CSV de tres columnas: nombre en el Excel, id del producto y (opcional) id del extra. Las líneas con # son comentarios. */
export function loadEquivalences(csv: string): Equivalences {
  const out: Equivalences = {};
  for (const line of csv.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.toLowerCase().startsWith("excel_name")) continue;
    const [name, productId, extraId] = t.split(",").map((x) => x.trim());
    if (name && productId) out[nameKey(name)] = extraId ? { productId, extraId } : { productId };
  }
  return out;
}

/* ---------- importación ---------- */

export interface ImportReport {
  imported: number;
  alreadyImported: number;
  skipped: { key: string; mesa: string; reason: string; detail?: string }[];
  unmappedProducts: string[];
  sinMedio: number;
  unknownMedios: string[];
  ambiguousDates: string[];
}

function mapMedio(label: string | null): PaymentMedio | null {
  const n = normalize(label ?? "");
  if (n === "bold") return "bold";
  if (n === "efectivo") return "efectivo";
  if (n === "bancolombia" || n === "transferencia") return "transferencia";
  if (["bre-b", "bre b", "breb", "bre_b"].includes(n)) return "bre_b";
  return null;
}

function tableFor(label: string): { tableId: string; salon: string | null; takeout: boolean } | null {
  const n = normalize(label);
  if (n.startsWith("llevar")) return { tableId: "llevar", salon: null, takeout: true };
  if (n.includes("luna")) return { tableId: "luna-hist", salon: "Luna", takeout: false };
  if (n.includes("equinoccio")) return { tableId: "eq-hist", salon: "Equinoccio", takeout: false };
  if (n.includes("sol")) return { tableId: "sol-hist", salon: "Sol", takeout: false };
  return null;
}

function toIsoDay(d: string): string | null {
  const [dd, mm, yyyy] = d.split("/").map(Number);
  if (!dd || !mm || !yyyy) return null;
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (dt.getUTCFullYear() !== yyyy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export async function importTickets(
  db: Db,
  tickets: ImportTicket[],
  eq: Equivalences,
  opts: { dryRun: boolean; dateOverrides?: Record<string, string> },
): Promise<ImportReport> {
  const report: ImportReport = {
    imported: 0,
    alreadyImported: 0,
    skipped: [],
    unmappedProducts: [],
    sinMedio: 0,
    unknownMedios: [],
    ambiguousDates: [],
  };
  const products = new Map((await db.query<{ id: string; name: string }>(`select id, name from products`)).map((p) => [p.id, p.name]));
  const extras = new Map(
    (await db.query<{ id: string; name: string; delta: number }>(`select id, name, delta from extras`)).map((e) => [e.id, e]),
  );
  const overrides = Object.fromEntries(Object.entries(opts.dateOverrides ?? {}).map(([k, v]) => [padDate(k), padDate(v)]));
  const unmapped = new Set<string>();
  const unknown = new Set<string>();
  const ambiguous = new Set<string>();
  const hist = new Map<string, string | null>();

  type Plan = { t: ImportTicket; day: string; table: NonNullable<ReturnType<typeof tableFor>>; lines: { name: string; productId: string; qty: number; unitPrice: number; extras: unknown[] }[]; total: number; medio: PaymentMedio };
  const plans: Plan[] = [];

  for (const t of tickets) {
    const skip = (reason: string, detail?: string) => report.skipped.push({ key: t.key, mesa: t.mesaLabel, reason, detail });
    const header = padDate(t.headerDate);
    let effective = header;
    if (overrides[header]) effective = overrides[header];
    else if (t.declaredDate && t.declaredDate !== header) {
      ambiguous.add(`${t.headerDate} (el total dice ${t.declaredDate})`);
      skip("FECHA_AMBIGUA", `${t.headerDate} ≠ ${t.declaredDate}`);
      continue;
    }
    const day = toIsoDay(effective);
    if (!day) {
      ambiguous.add(`${t.headerDate || "(sin fecha)"} (fecha inválida)`);
      skip("FECHA_AMBIGUA", "fecha inválida");
      continue;
    }
    const table = tableFor(t.mesaLabel);
    if (!table) {
      skip("MESA_DESCONOCIDA", t.mesaLabel);
      continue;
    }
    if (t.dirty) {
      skip("FILAS_DESCARTADAS", `desde la fila ${t.firstRow}`);
      continue;
    }
    if (t.lines.length === 0) {
      skip("CUENTA_SIN_PRODUCTOS");
      continue;
    }
    const missing = t.lines.filter((l) => {
      const m = eq[nameKey(l.name)];
      return !m || !products.has(m.productId);
    });
    if (missing.length) {
      for (const l of missing) unmapped.add(l.name);
      skip("PRODUCTO_SIN_EQUIVALENCIA", missing.map((l) => l.name).join(", "));
      continue;
    }
    const sum = t.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    if (t.declaredTotal !== null && sum !== t.declaredTotal) {
      skip("TOTAL_NO_CUADRA", `${sum} ≠ ${t.declaredTotal}`);
      continue;
    }
    const lines: Plan["lines"] = [];
    let badExtra = false;
    for (const l of t.lines) {
      const m = eq[nameKey(l.name)];
      const extra = m.extraId ? extras.get(m.extraId) : undefined;
      if (m.extraId && !extra) badExtra = true;
      const unitPrice = l.unitPrice - (extra?.delta ?? 0);
      if (unitPrice < 0) badExtra = true;
      lines.push({
        name: products.get(m.productId) as string,
        productId: m.productId,
        qty: l.qty,
        unitPrice,
        extras: extra ? [{ id: extra.id, name: extra.name, delta: extra.delta }] : [],
      });
    }
    if (badExtra) {
      skip("EXTRA_NO_CUADRA");
      continue;
    }
    const mapped = mapMedio(t.medioLabel);
    if (t.medioLabel && !mapped) unknown.add(t.medioLabel);
    const medio: PaymentMedio = mapped ?? "sin_medio";
    if (medio === "sin_medio") report.sinMedio += 1;
    plans.push({ t, day, table, lines, total: sum, medio });
  }

  for (const p of plans) {
    const exists = (await db.query(`select 1 from tickets where id = $1`, [p.t.key])).length > 0;
    if (exists) {
      report.alreadyImported += 1;
      continue;
    }
    report.imported += 1;
    if (opts.dryRun) continue;
    hist.set(p.table.tableId, p.table.salon);
  }

  if (!opts.dryRun) {
    await db.tx(async (q) => {
      for (const [tableId, salon] of hist) {
        if (tableId === "llevar") continue;
        await q.query(
          `insert into dining_tables (id, name, salon, capacity, active, is_takeout, sort)
           values ($1, 'Sin mesa (importado)', $2, null, false, false, 900) on conflict (id) do nothing`,
          [tableId, salon],
        );
      }
      for (const p of plans) {
        const n = Number(p.t.key.split("-").pop());
        const at = new Date(Date.parse(`${p.day}T17:00:00.000Z`) + n * 1000).toISOString();
        const tableName = p.table.takeout ? "Para llevar" : "Sin mesa (importado)";
        const inserted = await q.query(
          `insert into tickets (id, table_id, table_name, salon, is_takeout, status, opened_at, closed_at, service_enabled, created_by)
           values ($1, $2, $3, $4, $5, 'cerrado', $6::timestamptz, $6::timestamptz, false, 'import') on conflict (id) do nothing returning id`,
          [p.t.key, p.table.tableId, tableName, p.table.salon, p.table.takeout, at],
        );
        if (inserted.length === 0) continue;
        for (const [i, l] of p.lines.entries()) {
          await q.query(
            `insert into ticket_lines (id, ticket_id, product_id, name, unit_price, qty, extras)
             values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
            [`${p.t.key}-l${i + 1}`, p.t.key, l.productId, l.name, l.unitPrice, l.qty, JSON.stringify(l.extras)],
          );
        }
        await q.query(
          `insert into payments (id, ticket_id, medio, received, applied, idempotency_key, created_by)
           values ($1, $2, $3, $4, $4, $1, 'import')`,
          [`${p.t.key}-p1`, p.t.key, p.medio, p.total],
        );
      }
    });
  }

  report.unmappedProducts = [...unmapped];
  report.unknownMedios = [...unknown];
  report.ambiguousDates = [...ambiguous];
  return report;
}
