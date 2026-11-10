"use client";

import { useRef, useState, useTransition } from "react";
import { balance, planPayment, serviceAmount, subtotal, total } from "@/domain/money";
import { MEDIOS, type Medio, type PaymentMedio, type Ticket } from "@/domain/types";
import { errorMessage } from "@/lib/messages";
import { useOnline } from "@/lib/useOnline";
import { addPaymentAction, removePaymentAction, setServiceAction } from "../actions";

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
const newKey = () => globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export interface PaidInfo {
  closed: boolean;
  change: number;
  total: number;
}

export function PaymentPanel({ ticket, pct, onPaid }: { ticket: Ticket; pct: number; onPaid: (r: PaidInfo) => void }) {
  const online = useOnline();
  const [pending, startTransition] = useTransition();
  const [medio, setMedio] = useState<Medio>("efectivo");
  const [amount, setAmount] = useState("");
  const [received, setReceived] = useState("");
  const [svcOn, setSvcOn] = useState(ticket.service.enabled);
  const [svcCustom, setSvcCustom] = useState(ticket.service.custom === null ? "" : String(ticket.service.custom));
  const [error, setError] = useState<string | null>(null);
  const [svcSaves, setSvcSaves] = useState(0);
  const [svcError, setSvcError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const key = useRef(newKey());

  const locked = ticket.payments.length > 0;
  const custom = svcOn && svcCustom.trim() !== "" ? digits(svcCustom) : null;
  const preview: Ticket = locked ? ticket : { ...ticket, service: { ...ticket.service, enabled: svcOn, custom } };
  const suggested = serviceAmount({ ...ticket, service: { enabled: true, custom: null, frozenAmount: null } }, pct);
  const saldo = balance(preview, pct);
  const plan = planPayment(preview, pct, {
    medio,
    amount: amount === "" ? null : digits(amount),
    received: medio === "efectivo" && received !== "" ? digits(received) : null,
  });

  /** El servicio se guarda antes de cobrar: mientras se guarda, o si falló, no se deja registrar el pago. */
  function saveService(enabled: boolean, value: number | null) {
    setSvcSaves((n) => n + 1);
    void (async () => {
      try {
        const r = await setServiceAction({ ticketId: ticket.id, enabled, custom: value });
        setSvcError(r.ok ? null : errorMessage(r.error));
      } catch {
        setSvcError("No se pudo guardar el servicio. Revisa la conexión e inténtalo de nuevo.");
      } finally {
        setSvcSaves((n) => n - 1);
      }
    })();
  }

  function removePayment(paymentId: string) {
    if (inFlight.current || !online) return;
    inFlight.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const r = await removePaymentAction({ paymentId });
        if (!r.ok) setError(errorMessage(r.error));
      } catch {
        setError("No se pudo quitar el pago. Revisa la conexión e inténtalo de nuevo.");
      } finally {
        inFlight.current = false;
      }
    });
  }

  function submit() {
    if (inFlight.current || !online) return;
    inFlight.current = true;
    setError(null);
    const input = {
      ticketId: ticket.id,
      medio,
      amount: amount === "" ? null : digits(amount),
      received: medio === "efectivo" && received !== "" ? digits(received) : null,
      idempotencyKey: key.current,
      expectedTotal: total(preview, pct),
    };
    const totalToPay = total(preview, pct);
    startTransition(async () => {
      try {
        const r = await addPaymentAction(input);
        if (!r.ok) {
          setError(errorMessage(r.error));
          return;
        }
        key.current = newKey();
        setAmount("");
        setReceived("");
        onPaid({ closed: r.closed, change: r.change, total: totalToPay });
      } catch {
        setError("No se pudo registrar el pago. Revisa la conexión e inténtalo de nuevo.");
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <div className="stack">
      <div>
        <div className="kv">
          <span>Subtotal</span>
          <span>{fmt(subtotal(ticket))}</span>
        </div>
        {locked ? (
          serviceAmount(ticket, pct) > 0 ? (
            <div className="kv">
              <span>Servicio</span>
              <span>{fmt(serviceAmount(ticket, pct))}</span>
            </div>
          ) : null
        ) : (
          <div className="kv">
            <label className="sw">
              <input
                type="checkbox"
                checked={svcOn}
                onChange={(e) => {
                  setSvcOn(e.target.checked);
                  setSvcCustom("");
                  saveService(e.target.checked, null);
                }}
              />
              Servicio voluntario ({pct}%)
            </label>
            <input
              type="text"
              inputMode="numeric"
              aria-label="Valor del servicio"
              style={{ width: 100, textAlign: "right" }}
              value={svcCustom}
              placeholder={String(suggested)}
              disabled={!svcOn}
              onChange={(e) => setSvcCustom(e.target.value)}
              onBlur={() => saveService(svcOn, custom)}
            />
          </div>
        )}
        <div className="kv">
          <strong>Total a pagar</strong>
          <strong>{fmt(total(preview, pct))}</strong>
        </div>
      </div>

      {ticket.payments.length ? (
        <div>
          {ticket.payments.map((p) => (
            <div className="pay" key={p.id}>
              <span>{LABEL[p.medio]}</span>
              <span>
                {fmt(p.applied)}{" "}
                <button type="button" className="x" aria-label="Quitar pago" disabled={pending || !online} onClick={() => removePayment(p.id)}>
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="spread">
        <span className="muted">Saldo pendiente</span>
        <span className="big">{fmt(saldo)}</span>
      </div>

      <div className="seg">
        {MEDIOS.map((m) => (
          <button key={m} type="button" aria-pressed={medio === m} onClick={() => setMedio(m)}>
            {LABEL[m]}
          </button>
        ))}
      </div>
      <label className="f" htmlFor="payAmt">
        Monto de este pago
        <input id="payAmt" type="text" inputMode="numeric" value={amount} placeholder={String(saldo)} onChange={(e) => setAmount(e.target.value)} />
      </label>
      {medio === "efectivo" ? (
        <>
          <label className="f" htmlFor="payRec">
            Recibe del cliente (opcional)
            <input id="payRec" type="text" inputMode="numeric" value={received} onChange={(e) => setReceived(e.target.value)} />
          </label>
          <div className="chips">
            {[10000, 20000, 50000, 100000].map((v) => (
              <button key={v} type="button" className="chip" onClick={() => setReceived(String(v))}>
                {fmt(v)}
              </button>
            ))}
          </div>
          <div className="small">
            {plan.ok && plan.change > 0 ? (
              <>
                Cambio a devolver: <strong>{fmt(plan.change)}</strong>
              </>
            ) : plan.ok ? (
              <span className="muted">Pago exacto</span>
            ) : (
              <span style={{ color: "var(--bad)" }}>{errorMessage(plan.error)}</span>
            )}
          </div>
        </>
      ) : null}
      {svcError ? <div className="banner bad">{svcError}</div> : null}
      {error ? <div className="banner bad">{error}</div> : null}
      <button type="button" className="btn primary" disabled={pending || !online || svcSaves > 0 || svcError !== null} onClick={submit}>
        Registrar pago
      </button>
    </div>
  );
}
