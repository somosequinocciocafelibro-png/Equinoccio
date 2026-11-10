import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { businessDay } from "@/domain/day";
import { reportSales } from "@/domain/reports";
import { MEDIOS, type PaymentMedio } from "@/domain/types";
import { RANGES, rangeFor } from "@/lib/ranges";
import { requireRole } from "@/server/auth";
import { nowMs } from "@/server/clock";
import { loadTickets } from "@/server/closings";
import { getDb } from "@/server/db";

export const metadata = { title: "Reportes · Caja Equinoccio" };

const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;
const LABEL: Record<PaymentMedio, string> = { efectivo: "Efectivo", transferencia: "Transferencia", bre_b: "Bre-B", bold: "Bold", sin_medio: "Sin medio" };
const shortDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" });

function Bars({ items }: { items: { label: string; sub?: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="bars">
      {items.map((i) => (
        <div className="bar" key={i.label}>
          <i style={{ width: `${Math.round((i.value / max) * 100)}%` }} />
          <span>
            {i.label}
            {i.sub ? <span className="muted small"> {i.sub}</span> : null}
          </span>
          <span>{fmt(i.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { role } = await requireRole("viewReports");
  const { range: rangeParam } = await searchParams;
  const key = RANGES.some((r) => r.key === rangeParam) ? (rangeParam as string) : "hoy";
  const today = businessDay(new Date(nowMs()).toISOString());
  const range = rangeFor(key, today);
  const tickets = await loadTickets(getDb(), { status: "cerrado", from: range.from, to: range.to });
  const r = reportSales(tickets, range);
  const maxDay = Math.max(1, ...r.byDay.map((d) => d.sales));

  return (
    <AppShell role={role} active="reportes">
      <div className="row" style={{ marginBottom: 14 }}>
        <h2 style={{ marginRight: 8 }}>Reportes</h2>
        <div className="chips">
          {RANGES.map((x) => (
            <Link key={x.key} href={`/reportes?range=${x.key}`} className={`chip${key === x.key ? " on" : ""}`}>
              {x.label}
            </Link>
          ))}
        </div>
      </div>
      {r.count === 0 ? (
        <div className="empty">
          <strong>Aún no hay ventas en este periodo</strong>
          Cobra una cuenta y aparecerá aquí.
        </div>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <div className="row" style={{ gap: 32 }}>
              <div>
                <div className="muted small">Ventas</div>
                <div className="big">{fmt(r.sales)}</div>
              </div>
              <div>
                <div className="muted small">Cuentas</div>
                <div className="big">{r.count}</div>
              </div>
              <div>
                <div className="muted small">Promedio por cuenta</div>
                <div className="big">{fmt(r.avg)}</div>
              </div>
              {r.service ? (
                <div>
                  <div className="muted small">Servicio recaudado</div>
                  <div className="big">{fmt(r.service)}</div>
                </div>
              ) : null}
            </div>
          </div>
          {r.byDay.length > 1 ? (
            <div className="card">
              <h3>Ventas por día</h3>
              <div className="days">
                {r.byDay.map((d) => (
                  <div className="day" key={d.day} title={fmt(d.sales)}>
                    <span>{Math.round(d.sales / 1000)}k</span>
                    <b style={{ height: `${Math.max(2, Math.round((d.sales / maxDay) * 88))}%` }} />
                    <span>{shortDay(d.day)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid2">
            <div className="card">
              <h3>Por medio de pago</h3>
              <p className="muted small" style={{ margin: "2px 0 0" }}>
                Incluye el servicio cobrado.
              </p>
              <Bars items={[...MEDIOS, "sin_medio" as const].map((m) => ({ label: LABEL[m], value: r.byMedio[m] })).filter((i) => i.value > 0)} />
            </div>
            <div className="card">
              <h3>Por salón</h3>
              <Bars items={r.bySalon.map((s) => ({ label: s.salon, value: s.sales }))} />
            </div>
            <div className="card">
              <h3>Por mesa</h3>
              <Bars items={r.byTable.map((t) => ({ label: t.table, value: t.sales }))} />
            </div>
          </div>
          <div className="card">
            <h3>Productos más vendidos</h3>
            <Bars items={r.byProduct.slice(0, 15).map((p) => ({ label: p.name, sub: `${p.qty} u.`, value: p.sales }))} />
          </div>
        </div>
      )}
    </AppShell>
  );
}
