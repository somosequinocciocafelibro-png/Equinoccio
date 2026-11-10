import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { businessDay } from "@/domain/day";
import { subtotal } from "@/domain/money";
import { reportSales } from "@/domain/reports";
import { MEDIOS, type Ticket } from "@/domain/types";
import { requireRole } from "@/server/auth";
import { nowMs } from "@/server/clock";
import { isDayClosed, loadTickets } from "@/server/closings";
import { getDb } from "@/server/db";
import { listTables, type TableInfo } from "@/server/queries";

export const metadata = { title: "Mesas · Caja Equinoccio" };

const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;
const MEDIO_LABEL = { efectivo: "Efectivo", transferencia: "Transferencia", bre_b: "Bre-B", bold: "Bold" } as const;

function since(iso: string, now: number): string {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.floor(m / 60)} h ${m % 60} min`;
}

function motif(t: TableInfo): string {
  if (t.isTakeout) return "n";
  const s = (t.salon ?? "").toLowerCase();
  return s === "sol" ? "sol" : s === "luna" ? "luna" : s === "equinoccio" ? "eq" : "n";
}

function TableCard({ t, ticket, now }: { t: TableInfo; ticket: Ticket | undefined; now: number }) {
  if (t.isTakeout) {
    return (
      <Link className="mesa" href={`/mesas/${t.id}`}>
        <span className="motif n" />
        <span className="nm">{t.name}</span>
        <span className="st">Pago inmediato</span>
        <span className="tot" style={{ fontSize: 15, color: "var(--accent)" }}>
          + Nueva venta rápida
        </span>
      </Link>
    );
  }
  return (
    <Link className={`mesa${ticket ? " open" : ""}`} href={`/mesas/${t.id}`}>
      <span className={`motif ${motif(t)}`} />
      <span className="nm">{t.name}</span>
      {ticket ? (
        <>
          <span className="st">
            Cuenta abierta · {ticket.lines.reduce((s, l) => s + l.qty, 0)} productos · {since(ticket.openedAt, now)}
          </span>
          <span className="tot">{fmt(subtotal(ticket))}</span>
        </>
      ) : (
        <span className="st">Libre{t.capacity ? ` · ${t.capacity} personas` : ""}</span>
      )}
    </Link>
  );
}

export default async function MesasPage() {
  const { role } = await requireRole("sell");
  const db = getDb();
  const now = nowMs();
  const today = businessDay(new Date(now).toISOString());
  const [tables, open, closedToday, locked] = await Promise.all([
    listTables(db),
    loadTickets(db, { status: "abierto" }),
    loadTickets(db, { status: "cerrado", closedDay: today }),
    isDayClosed(db, today),
  ]);
  const report = reportSales(closedToday, { from: today, to: today });
  const salons = [...new Set(tables.filter((t) => !t.isTakeout).map((t) => t.salon ?? "Mesas"))];
  const takeout = tables.filter((t) => t.isTakeout);
  const openTake = open.filter((t) => tables.find((x) => x.id === t.tableId)?.isTakeout);

  return (
    <AppShell role={role} active="mesas">
      {locked ? <div className="banner">El día de hoy está cerrado. Un administrador debe reabrirlo para seguir vendiendo.</div> : null}
      <div className="mesas-layout">
        <section>
          <h2>Mesas</h2>
          {tables.length === 0 ? (
            <div className="empty">
              <strong>No hay mesas todavía</strong>Agrégalas en Catálogo.
            </div>
          ) : null}
          {salons.map((s) => {
            const group = tables.filter((t) => !t.isTakeout && (t.salon ?? "Mesas") === s);
            return (
              <div className="salon" key={s}>
                <h3>
                  <span className={`motif ${motif(group[0])}`} />
                  {s === "Mesas" ? "Mesas" : `Salón ${s}`}
                </h3>
                <div className="mesas">
                  {group.map((t) => (
                    <TableCard key={t.id} t={t} ticket={open.find((x) => x.tableId === t.id)} now={now} />
                  ))}
                </div>
              </div>
            );
          })}
          {takeout.length ? (
            <div className="salon">
              <h3>Para llevar</h3>
              <div className="mesas">
                {takeout.map((t) => (
                  <TableCard key={t.id} t={t} ticket={undefined} now={now} />
                ))}
              </div>
              {openTake.length ? (
                <>
                  <p className="muted small">Ventas rápidas abiertas</p>
                  <div className="chips">
                    {openTake.map((t) => (
                      <Link key={t.id} className="chip" href={`/mesas/${t.tableId}?ticket=${t.id}`}>
                        {fmt(subtotal(t))} · {since(t.openedAt, now)}
                      </Link>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </section>
        <aside className="card">
          <h3>Hoy</h3>
          <div className="big" style={{ marginTop: 8 }}>
            {fmt(report.sales)}
          </div>
          <div className="muted small">
            {report.count} cuentas cerradas · {open.length} abiertas
          </div>
          {report.service ? <div className="muted small">Servicio recaudado: {fmt(report.service)} (incluido en los medios)</div> : null}
          <div style={{ marginTop: 12 }}>
            {MEDIOS.map((m) => (
              <div className="kv" key={m}>
                <span>{MEDIO_LABEL[m]}</span>
                <span>{fmt(report.byMedio[m])}</span>
              </div>
            ))}
          </div>
          <Link className="btn primary" href="/cierre" style={{ display: "block", textAlign: "center", marginTop: 14 }}>
            Ir al cierre del día
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}
