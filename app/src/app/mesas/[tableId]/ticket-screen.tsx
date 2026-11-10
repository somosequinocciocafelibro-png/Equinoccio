"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { lineTotal, subtotal } from "@/domain/money";
import type { Ticket } from "@/domain/types";
import { errorMessage } from "@/lib/messages";
import { matchProducts, parseSearch } from "@/lib/parseSearch";
import { useOnline } from "@/lib/useOnline";
import type { ExtraInfo, ProductInfo, TableInfo } from "@/server/queries";
import { addLineAction, setQtyAction, toggleExtraAction } from "../actions";

const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

interface Props {
  table: TableInfo;
  ticket: Ticket | null;
  products: ProductInfo[];
  extras: ExtraInfo[];
  pct: number;
  /** Panel de cobro (se muestra al pulsar Cobrar). */
  payment?: ReactNode;
}

export function TicketScreen({ table, ticket, products, extras, payment }: Props) {
  const router = useRouter();
  const online = useOnline();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todos");
  const [error, setError] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState(false);

  const { qty, text } = parseSearch(q);
  const categories = useMemo(() => ["Todos", ...new Set(products.map((p) => p.category))], [products]);
  const shown = matchProducts(products, text, cat);
  const blocked = !online || pending;

  function run(action: () => Promise<{ ok: boolean; error?: string; ticketId?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        setError(errorMessage(r.error ?? ""));
        return;
      }
      if (r.ticketId && r.ticketId !== ticket?.id) router.replace(`/mesas/${table.id}?ticket=${r.ticketId}`);
    });
  }

  function add(productId: string, n: number) {
    setQ("");
    run(() => addLineAction({ tableId: table.id, ticketId: ticket?.id ?? null, productId, qty: n }));
  }

  const lines = ticket?.lines ?? [];
  const sellable = ticket?.status === "abierto" || ticket === null;

  return (
    <div className="ticket-layout">
      <section>
        <h2>{table.displayName}</h2>
        {!online ? <div className="banner bad">Sin conexión: no se puede vender hasta que vuelva el internet.</div> : null}
        {error ? <div className="banner bad">{error}</div> : null}
        <div className="card">
          <label className="f" htmlFor="q">
            Buscar producto
            <span className="small">Enter agrega el primero · escribe &quot;3 latte&quot; para agregar varios</span>
          </label>
          <input
            id="q"
            type="text"
            autoComplete="off"
            autoFocus
            value={q}
            placeholder="Ej. latte"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQ("");
              if (e.key === "Enter") {
                e.preventDefault();
                if (!blocked && shown.length) add(shown[0].id, qty);
              }
            }}
          />
          <div className="chips" style={{ marginTop: 10 }}>
            {categories.map((c) => (
              <button key={c} type="button" className={`chip${cat === c ? " on" : ""}`} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="prods">
          {shown.length === 0 ? (
            <div className="empty" style={{ gridColumn: "1 / -1" }}>
              {products.length ? `Ningún producto coincide con "${q}".` : "El catálogo está vacío. Agrega productos en Catálogo."}
            </div>
          ) : (
            shown.map((p) => (
              <button key={p.id} type="button" className="prod" disabled={blocked || !sellable} onClick={() => add(p.id, 1)}>
                <span className="pn">{p.name}</span>
                <span className="pp">{fmt(p.price)}</span>
              </button>
            ))
          )}
        </div>
      </section>

      <aside className="card cuenta">
        <div className="spread">
          <h3>{ticket ? "Cuenta abierta" : "Cuenta nueva"}</h3>
          {ticket ? <span className="pill warn">Abierta</span> : null}
        </div>
        {lines.length === 0 ? (
          <div className="empty" style={{ marginTop: 12 }}>
            <strong>Cuenta vacía</strong>
            Toca un producto o escribe su nombre y pulsa Enter.
          </div>
        ) : (
          <ul className="lines">
            {lines.map((l) => (
              <li className="line" key={l.id}>
                <div className="l1">
                  <span>
                    {l.name}
                    {l.extras.length ? <span className="muted small"> + {l.extras.map((x) => x.name).join(", ")}</span> : null}
                  </span>
                  <span>{fmt(lineTotal(l))}</span>
                </div>
                <div className="l2">
                  <div className="qty">
                    <button type="button" aria-label="Quitar uno" disabled={blocked} onClick={() => run(() => setQtyAction({ lineId: l.id, qty: l.qty - 1 }))}>
                      −
                    </button>
                    <span>{l.qty}</span>
                    <button type="button" aria-label="Agregar uno" disabled={blocked} onClick={() => run(() => setQtyAction({ lineId: l.id, qty: l.qty + 1 }))}>
                      +
                    </button>
                  </div>
                  <div className="chips">
                    {extras.map((x) => {
                      const on = l.extras.some((e) => e.id === x.id);
                      return (
                        <button
                          key={x.id}
                          type="button"
                          className={`chip${on ? " on" : ""}`}
                          aria-pressed={on}
                          disabled={blocked}
                          onClick={() => run(() => toggleExtraAction({ lineId: l.id, extraId: x.id }))}
                        >
                          {x.name}
                          {x.delta ? ` +${fmt(x.delta)}` : ""}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" className="x" aria-label="Quitar producto" disabled={blocked} onClick={() => run(() => setQtyAction({ lineId: l.id, qty: 0 }))}>
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {ticket ? (
          <div className="totals">
            <div className="spread">
              <span className="muted">Subtotal</span>
              <span className="t">{fmt(subtotal(ticket))}</span>
            </div>
          </div>
        ) : null}
        <div className="stack">
          {payment && lines.length > 0 ? (
            <button type="button" className="btn primary" disabled={blocked} onClick={() => setCobrando((v) => !v)}>
              {cobrando ? "Ocultar cobro" : "Cobrar"}
            </button>
          ) : null}
          {cobrando ? payment : null}
          <Link className="btn" href="/mesas" style={{ textAlign: "center" }}>
            Volver a mesas
          </Link>
        </div>
      </aside>
    </div>
  );
}
