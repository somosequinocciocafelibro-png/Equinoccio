"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { errorMessage } from "@/lib/messages";
import { useOnline } from "@/lib/useOnline";
import type { ExtraInfo, ProductInfo, TableInfo } from "@/server/queries";
import { saveExtraAction, saveProductAction, saveServicePctAction, saveTableAction } from "./actions";

type Product = ProductInfo & { active: boolean };
type Extra = ExtraInfo & { active: boolean };
type Table = TableInfo & { active: boolean };
type Result = { ok: boolean; error?: string };

const int = (v: string) => {
  const n = parseInt(v.replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
};

interface Props {
  pct: number;
  products: Product[];
  extras: Extra[];
  tables: Table[];
}

export function CatalogEditor({ pct, products, extras, tables }: Props) {
  const router = useRouter();
  const online = useOnline();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /** Ejecuta un guardado; el error del servidor se muestra y los cambios buenos refrescan los datos. */
  function save(action: () => Promise<Result>, after?: () => void) {
    if (!online) {
      setError("Sin conexión: no se puede guardar hasta que vuelva el internet.");
      return;
    }
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

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h2>Catálogo</h2>
      {error ? <div className="banner bad">{error}</div> : null}
      <ServiceCard pct={pct} save={save} />
      <ProductsCard products={products} save={save} />
      <ExtrasCard extras={extras} save={save} />
      <TablesCard tables={tables} save={save} />
    </div>
  );
}

type Save = (action: () => Promise<Result>, after?: () => void) => void;

function ServiceCard({ pct, save }: { pct: number; save: Save }) {
  const [value, setValue] = useState(String(pct));
  return (
    <div className="card">
      <h3>Servicio voluntario</h3>
      <p className="muted small" style={{ margin: "4px 0 8px" }}>
        Porcentaje sugerido al cobrar. El cliente puede quitarlo o cambiar el valor. Se redondea a los $100.
      </p>
      <label className="f" htmlFor="pct" style={{ width: 140 }}>
        Porcentaje de servicio
        <input
          id="pct"
          type="number"
          min={0}
          max={30}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => int(value) !== pct && save(() => saveServicePctAction({ pct: int(value) }))}
        />
      </label>
    </div>
  );
}

function ProductRow({ p, save }: { p: Product; save: Save }) {
  const [d, setD] = useState({ name: p.name, category: p.category, price: String(p.price), active: p.active });
  const push = (next: typeof d) =>
    save(() => saveProductAction({ id: p.id, name: next.name, category: next.category, price: int(next.price), active: next.active }));
  const changed = (next: typeof d) =>
    next.name !== p.name || next.category !== p.category || int(next.price) !== p.price || next.active !== p.active;
  return (
    <div className="prow">
      <input type="text" aria-label={`Nombre ${p.name}`} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} onBlur={() => changed(d) && push(d)} />
      <input type="text" aria-label={`Categoría ${p.name}`} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} onBlur={() => changed(d) && push(d)} />
      <input type="number" min={0} step={500} aria-label={`Precio ${p.name}`} value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} onBlur={() => changed(d) && push(d)} />
      <label className="sw">
        <input
          type="checkbox"
          aria-label={`Activo ${p.name}`}
          checked={d.active}
          onChange={(e) => {
            const next = { ...d, active: e.target.checked };
            setD(next);
            push(next);
          }}
        />
        Activo
      </label>
    </div>
  );
}

function ProductsCard({ products, save }: { products: Product[]; save: Save }) {
  const [n, setN] = useState({ name: "", category: "", price: "" });
  const categories = [...new Set(products.map((p) => p.category))];
  return (
    <div className="card">
      <div className="spread">
        <h3>Productos</h3>
        <span className="muted small">{products.length} en total · los cambios se guardan al salir del campo</span>
      </div>
      <datalist id="categorias">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {products.length === 0 ? (
        <div className="empty" style={{ marginTop: 12 }}>
          <strong>El catálogo está vacío</strong>
          Agrega el primer producto abajo.
        </div>
      ) : (
        products.map((p) => <ProductRow key={`${p.id}-${p.name}-${p.category}-${p.price}-${p.active}`} p={p} save={save} />)
      )}
      <div className="prow" style={{ borderBottom: 0, marginTop: 10 }}>
        <input type="text" aria-label="Nombre del producto nuevo" placeholder="Nombre del producto" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <input type="text" list="categorias" aria-label="Categoría del producto nuevo" placeholder="Categoría" value={n.category} onChange={(e) => setN({ ...n, category: e.target.value })} />
        <input type="number" min={0} step={500} aria-label="Precio del producto nuevo" placeholder="Precio" value={n.price} onChange={(e) => setN({ ...n, price: e.target.value })} />
        <button
          type="button"
          className="btn primary"
          onClick={() =>
            save(
              () => saveProductAction({ name: n.name, category: n.category, price: int(n.price), active: true }),
              () => setN({ name: "", category: n.category, price: "" }),
            )
          }
        >
          Agregar producto
        </button>
      </div>
    </div>
  );
}

function ExtraRow({ e, save }: { e: Extra; save: Save }) {
  const [d, setD] = useState({ name: e.name, delta: String(e.delta), active: e.active });
  const push = (next: typeof d) => save(() => saveExtraAction({ id: e.id, name: next.name, delta: int(next.delta), active: next.active }));
  const changed = (next: typeof d) => next.name !== e.name || int(next.delta) !== e.delta || next.active !== e.active;
  return (
    <div className="prow">
      <input type="text" aria-label={`Nombre extra ${e.name}`} value={d.name} onChange={(ev) => setD({ ...d, name: ev.target.value })} onBlur={() => changed(d) && push(d)} />
      <span className="muted small">Suma al precio</span>
      <input type="number" step={500} aria-label={`Precio extra ${e.name}`} value={d.delta} onChange={(ev) => setD({ ...d, delta: ev.target.value })} onBlur={() => changed(d) && push(d)} />
      <label className="sw">
        <input
          type="checkbox"
          aria-label={`Activo extra ${e.name}`}
          checked={d.active}
          onChange={(ev) => {
            const next = { ...d, active: ev.target.checked };
            setD(next);
            push(next);
          }}
        />
        Activo
      </label>
    </div>
  );
}

function ExtrasCard({ extras, save }: { extras: Extra[]; save: Save }) {
  const [n, setN] = useState({ name: "", delta: "" });
  return (
    <div className="card">
      <h3>Extras</h3>
      <p className="muted small" style={{ margin: "4px 0 0" }}>
        Vainilla, caramelo y similares. Se marcan sobre cada producto de la cuenta.
      </p>
      {extras.map((e) => (
        <ExtraRow key={`${e.id}-${e.name}-${e.delta}-${e.active}`} e={e} save={save} />
      ))}
      <div className="prow" style={{ borderBottom: 0, marginTop: 10 }}>
        <input type="text" aria-label="Nombre del extra nuevo" placeholder="Nombre del extra" value={n.name} onChange={(ev) => setN({ ...n, name: ev.target.value })} />
        <span />
        <input type="number" step={500} aria-label="Precio del extra nuevo" placeholder="+ precio" value={n.delta} onChange={(ev) => setN({ ...n, delta: ev.target.value })} />
        <button type="button" className="btn primary" onClick={() => save(() => saveExtraAction({ name: n.name, delta: int(n.delta), active: true }), () => setN({ name: "", delta: "" }))}>
          Agregar extra
        </button>
      </div>
    </div>
  );
}

function TableRow({ t, save }: { t: Table; save: Save }) {
  const [d, setD] = useState({ name: t.name, salon: t.salon ?? "", capacity: t.capacity === null ? "" : String(t.capacity), active: t.active });
  const push = (next: typeof d) =>
    save(() => saveTableAction({ id: t.id, name: next.name, salon: next.salon || null, capacity: next.capacity.trim() === "" ? null : int(next.capacity), active: next.active }));
  const changed = (next: typeof d) =>
    next.name !== t.name || next.salon !== (t.salon ?? "") || next.capacity !== (t.capacity === null ? "" : String(t.capacity)) || next.active !== t.active;
  return (
    <div className="prow">
      <input type="text" aria-label={`Nombre mesa ${t.displayName}`} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} onBlur={() => changed(d) && push(d)} />
      <input type="text" aria-label={`Salón ${t.displayName}`} placeholder={t.isTakeout ? "Venta rápida" : "Salón"} value={d.salon} onChange={(e) => setD({ ...d, salon: e.target.value })} onBlur={() => changed(d) && push(d)} />
      <input type="number" min={1} aria-label={`Personas ${t.displayName}`} placeholder="Personas" value={d.capacity} onChange={(e) => setD({ ...d, capacity: e.target.value })} onBlur={() => changed(d) && push(d)} />
      <label className="sw">
        <input
          type="checkbox"
          aria-label={`Activa ${t.displayName}`}
          checked={d.active}
          onChange={(e) => {
            const next = { ...d, active: e.target.checked };
            setD(next);
            push(next);
          }}
        />
        Activa
      </label>
    </div>
  );
}

function TablesCard({ tables, save }: { tables: Table[]; save: Save }) {
  const [n, setN] = useState({ name: "", salon: "", capacity: "" });
  return (
    <div className="card">
      <h3>Mesas</h3>
      {tables.length === 0 ? (
        <div className="empty" style={{ marginTop: 12 }}>
          <strong>No hay mesas</strong>
          Agrega la primera abajo.
        </div>
      ) : (
        tables.map((t) => <TableRow key={`${t.id}-${t.name}-${t.salon}-${t.capacity}-${t.active}`} t={t} save={save} />)
      )}
      <div className="prow" style={{ borderBottom: 0, marginTop: 10 }}>
        <input type="text" aria-label="Nombre de la mesa nueva" placeholder="Nombre (ej. Mesa 4)" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <input type="text" aria-label="Salón de la mesa nueva" placeholder="Salón" value={n.salon} onChange={(e) => setN({ ...n, salon: e.target.value })} />
        <input type="number" min={1} aria-label="Personas de la mesa nueva" placeholder="Personas" value={n.capacity} onChange={(e) => setN({ ...n, capacity: e.target.value })} />
        <button
          type="button"
          className="btn primary"
          onClick={() =>
            save(
              () => saveTableAction({ name: n.name, salon: n.salon || null, capacity: n.capacity.trim() === "" ? null : int(n.capacity), active: true }),
              () => setN({ name: "", salon: n.salon, capacity: "" }),
            )
          }
        >
          Agregar mesa
        </button>
      </div>
    </div>
  );
}
