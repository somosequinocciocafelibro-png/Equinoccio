import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/login/actions";
import type { Role } from "@/server/auth";

type Section = "mesas" | "cierre" | "reportes" | "catalogo";

const TABS: { id: Section; href: string; label: string; adminOnly: boolean }[] = [
  { id: "mesas", href: "/mesas", label: "Mesas", adminOnly: false },
  { id: "cierre", href: "/cierre", label: "Cierre del día", adminOnly: false },
  { id: "reportes", href: "/reportes", label: "Reportes", adminOnly: true },
  { id: "catalogo", href: "/catalogo", label: "Catálogo", adminOnly: true },
];

export function AppShell({ role, active, children }: { role: Role; active: Section; children: ReactNode }) {
  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="motif eq" />
          <span>Caja Equinoccio</span>
        </div>
        <nav className="tabs" aria-label="Secciones">
          {TABS.filter((t) => !t.adminOnly || role === "admin").map((t) => (
            <Link key={t.id} href={t.href} className="tab" aria-current={t.id === active ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
        <span className="pill">{role === "admin" ? "Administrador" : "Caja"}</span>
        <form action={logoutAction}>
          <button type="submit" className="btn sm">
            Salir
          </button>
        </form>
      </header>
      <main>{children}</main>
    </>
  );
}
