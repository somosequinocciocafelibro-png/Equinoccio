"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { computeClosing } from "@/domain/cierre";
import { total } from "@/domain/money";
import { MEDIOS, type Medio, type PaymentMedio, type Ticket } from "@/domain/types";
import { errorMessage } from "@/lib/messages";
import { useOnline } from "@/lib/useOnline";
import type { ClosingRecord } from "@/server/closings";
import type { VoidedInfo } from "@/server/queries";
import { closeDayAction, reopenDayAction, voidTicketAction } from "./actions";

const LABEL: Record<PaymentMedio, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  bre_b: "Bre-B",
  bold: "Bold",
  sin_medio: "Sin medio",
};
const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;
const digits = (v: string) => {
  const n = parseInt(v.replace(/[^\d]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
};
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
const diffText = (d: number | null) =>
  d === null ? <span className="muted">—</span> : d === 0 ? <span className="diff ok">Cuadra</span> : <span className="diff bad">{`${d > 0 ? "+" : "−"}${fmt(Math.abs(d))}`}</span>;

interface Props {
  day: string;
  isAdmin: boolean;
  tickets: Ticket[];
  voided: VoidedInfo[];
  openCount: number;
  closing: ClosingRecord | null;
  /** Cuentas abiertas (de cualquier día) que impiden cerrar: se listan para poder resolverlas. */
  openTickets?: { id: string; tableId: string; tableName: string; subtotal: number }[];
}

export function CierreForm({ day, isAdmin, tickets, voided, openCount, closing, openTickets = [] }: Props) {
  const router = useRouter();
  const online = useOnline();
  const [pending, startTransition] = useTransition();
  const [base, setBase] = useState("");
  const [real, setReal] = useState<Record<Medio, string>>({ efectivo: "", transferencia: "", bre_b: "", bold: "" });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const locked = closing?.locked === true;
  const realNum = Object.fromEntries(MEDIOS.map((m) => [m, real[m].trim() === "" ? null : digits(real[m])])) as Record<Medio, number | null>;
  const calc = computeClosing({ day, tickets, base: digits(base), real: realNum, note, openTicketsCount: openCount });

  function run(action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        const r = await action();
        if (!r.ok) {
          setError(errorMessage(r.error ?? ""));
          return;
        }
        after?.();
        router.refresh();
      } catch {
        setError("No se pudo guardar. Revisa la conexión e inténtalo de nuevo.");
      }
    });
  }

  const blocked = pending || !online;
  const sorted = [...tickets].sort((a, b) => (a.closedAt ?? "").localeCompare(b.closedAt ?? ""));

  return (
    <div className="stack">
      <div className="row">
        <h2 style={{ marginRight: 8 }}>Cierre del día</h2>
        <label className="f" htmlFor="cdate" style={{ width: 170 }}>
          Fecha
          <input id="cdate" type="date" defaultValue={day} onChange={(e) => e.target.value && router.push(`/cierre?day=${e.target.value}`)} />
        </label>
      </div>
      {error ? <div className="banner bad">{error}</div> : null}
      {openTickets.length > 0 ? (
        <div className="card">
          <h3>Cuentas abiertas</h3>
          <p className="muted small" style={{ margin: "4px 0 8px" }}>
            Hay que cobrarlas o anularlas antes de cerrar el día.
          </p>
          <div className="chips">
            {openTickets.map((t) => (
              <Link key={t.id} className="chip" href={`/mesas/${t.tableId}?ticket=${t.id}`}>
                {`${t.tableName} · ${fmt(t.subtotal)}`}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {locked && closing ? (
        <div className="card scroll">
          <div className="banner ok">
            Día cerrado a las {time(closing.closedAt)}. Ventas: {fmt(closing.sales)} en {closing.ticketCount} cuentas.
            {closing.service ? ` Servicio recaudado: ${fmt(closing.service)}.` : ""}
          </div>
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Medio</th>
                <th className="r">Esperado</th>
                <th className="r">Real</th>
                <th className="r">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {MEDIOS.map((m) => (
                <tr key={m}>
                  <td>{LABEL[m]}</td>
                  <td className="r">{fmt(closing.expected[m])}</td>
                  <td className="r">{closing.real[m] === null ? <span className="muted">—</span> : fmt(closing.real[m] as number)}</td>
                  <td className="r">{diffText(closing.diff[m])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small" style={{ margin: "10px 0 0" }}>
            Base de caja: {fmt(closing.base)}
            {closing.note ? ` · Nota: ${closing.note}` : ""}
            {closing.reopened.length ? ` · Reabierto ${closing.reopened.length} vez/veces antes.` : ""}
          </p>
          {isAdmin ? (
            reopening ? (
              <div className="stack" style={{ marginTop: 12 }}>
                <label className="f" htmlFor="reopenReason">
                  Motivo
                  <input id="reopenReason" type="text" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Ej. faltó registrar una venta" />
                </label>
                <div className="row">
                  <button type="button" className="btn primary" disabled={blocked} onClick={() => run(() => reopenDayAction({ day, reason: reopenReason }), () => setReopening(false))}>
                    Confirmar reapertura
                  </button>
                  <button type="button" className="btn" onClick={() => setReopening(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <button type="button" className="btn" onClick={() => setReopening(true)}>
                  Reabrir día
                </button>
              </div>
            )
          ) : null}
        </div>
      ) : (
        <div className="card">
          {openCount > 0 ? <div className="banner bad" style={{ marginBottom: 12 }}>Quedan {openCount} cuenta(s) sin cobrar ni anular.</div> : null}
          <div className="row" style={{ marginBottom: 12, gap: 24 }}>
            <label className="f" htmlFor="base" style={{ width: 220 }}>
              Base de caja (sencillo inicial)
              <input id="base" type="text" inputMode="numeric" value={base} placeholder="0" onChange={(e) => setBase(e.target.value)} />
            </label>
            <div>
              <div className="muted small">Ventas del día</div>
              <div className="big">{fmt(calc.sales)}</div>
            </div>
            <div className="muted small">
              {calc.ticketCount} cuentas cerradas
              {calc.service ? ` · servicio recaudado ${fmt(calc.service)} (va incluido en los medios y se entrega al equipo)` : ""}
            </div>
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Medio</th>
                  <th className="r">Esperado</th>
                  <th>Real</th>
                  <th className="r">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {calc.rows.map((r) => (
                  <tr key={r.medio}>
                    <td>
                      {LABEL[r.medio]}
                      {r.medio === "efectivo" ? <div className="muted small">Base {fmt(digits(base))} + ventas {fmt(r.expected - digits(base))}</div> : null}
                    </td>
                    <td className="r">{fmt(r.expected)}</td>
                    <td style={{ width: 150 }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label={`Real ${LABEL[r.medio]}`}
                        value={real[r.medio]}
                        placeholder={r.medio === "efectivo" ? "Obligatorio" : "Opcional"}
                        onChange={(e) => setReal((v) => ({ ...v, [r.medio]: e.target.value }))}
                      />
                    </td>
                    <td className="r">{diffText(r.diff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="f" htmlFor="nota" style={{ marginTop: 12 }}>
            Nota {calc.hasDiff ? "(obligatoria: hay diferencias)" : "(opcional)"}
            <input id="nota" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. faltaron $2.000, propina entregada aparte" />
          </label>
          <div className="row" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn primary"
              disabled={!calc.canClose || blocked}
              onClick={() => run(() => closeDayAction({ day, base: digits(base), real: realNum, note: note.trim() }))}
            >
              Cerrar día
            </button>
            {calc.reason ? <span className="muted small">{errorMessage(calc.reason)}</span> : null}
          </div>
        </div>
      )}

      {sorted.length + voided.length === 0 ? (
        <div className="empty">
          <strong>Sin ventas este día</strong>
          Las cuentas cobradas aparecerán aquí.
        </div>
      ) : (
        <div className="card scroll">
          <h3>Cuentas del día</h3>
          <table style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Mesa</th>
                <th>Detalle</th>
                <th className="r">Total</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id}>
                  <td>{t.closedAt ? time(t.closedAt) : ""}</td>
                  <td>{t.salon ? `${t.salon} · ${t.tableName}` : t.tableName}</td>
                  <td className="small">
                    {t.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                    <div className="muted">{t.payments.map((p) => `${LABEL[p.medio]} ${fmt(p.applied)}`).join(" + ")}</div>
                    {voidingId === t.id ? (
                      <div className="stack" style={{ marginTop: 8 }}>
                        <label className="f" htmlFor={`void-${t.id}`}>
                          Motivo
                          <input id={`void-${t.id}`} type="text" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Ej. pedido equivocado" />
                        </label>
                        <div className="row">
                          <button type="button" className="btn sm danger" disabled={blocked} onClick={() => run(() => voidTicketAction({ ticketId: t.id, reason: voidReason }), () => { setVoidingId(null); setVoidReason(""); })}>
                            Anular cuenta
                          </button>
                          <button type="button" className="btn sm" onClick={() => setVoidingId(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </td>
                  <td className="r">{fmt(total(t, 0))}</td>
                  <td>
                    <span className="pill ok">Cerrada</span>
                  </td>
                  <td>
                    {isAdmin && !locked && voidingId !== t.id ? (
                      <button type="button" className="btn sm danger" onClick={() => { setVoidingId(t.id); setVoidReason(""); }}>
                        Anular
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {voided.map((v) => (
                <tr key={v.id}>
                  <td>{time(v.at)}</td>
                  <td>{v.tableName}</td>
                  <td className="small muted">Motivo: {v.reason}</td>
                  <td className="r" />
                  <td>
                    <span className="pill bad">Anulada</span>
                  </td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
