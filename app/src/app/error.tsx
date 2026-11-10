"use client";

import Link from "next/link";

/** Pantalla de error de la aplicación: en medio del servicio nunca debe verse la página genérica de Next. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <div className="card stack" style={{ maxWidth: 420, margin: "10vh auto 0" }}>
        <h2>Algo salió mal</h2>
        <p className="muted" style={{ margin: 0 }}>
          No se pudo completar la acción. Revisa la conexión e inténtalo de nuevo. Si sigue pasando, avisa al administrador.
        </p>
        <div className="row">
          <button type="button" className="btn primary" onClick={reset}>
            Intentar de nuevo
          </button>
          <Link className="btn" href="/mesas">
            Ir a mesas
          </Link>
        </div>
      </div>
    </main>
  );
}
