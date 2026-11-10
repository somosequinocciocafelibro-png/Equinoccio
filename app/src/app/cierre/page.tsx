import { AppShell } from "@/components/AppShell";
import { businessDay } from "@/domain/day";
import { subtotal } from "@/domain/money";
import { requireRole } from "@/server/auth";
import { nowMs } from "@/server/clock";
import { getClosing, loadTickets } from "@/server/closings";
import { getDb } from "@/server/db";
import { listVoidedOn } from "@/server/queries";
import { CierreForm } from "./cierre-form";

export const metadata = { title: "Cierre del día · Caja Equinoccio" };

export default async function CierrePage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { role } = await requireRole("closeDay");
  const { day: dayParam } = await searchParams;
  const today = businessDay(new Date(nowMs()).toISOString());
  const day = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : today;
  const db = getDb();
  const [tickets, voided, open, closing] = await Promise.all([
    loadTickets(db, { status: "cerrado", closedDay: day }),
    listVoidedOn(db, day),
    loadTickets(db, { status: "abierto" }),
    getClosing(db, day),
  ]);
  return (
    <AppShell role={role} active="cierre">
      <CierreForm
        key={`${day}-${closing?.locked ? "cerrado" : "abierto"}`}
        day={day}
        isAdmin={role === "admin"}
        tickets={tickets}
        voided={voided}
        openCount={open.length}
        closing={closing}
        openTickets={open.map((t) => ({
          id: t.id,
          tableId: t.tableId,
          tableName: t.salon ? `${t.salon} · ${t.tableName}` : t.tableName,
          subtotal: subtotal(t),
        }))}
      />
    </AppShell>
  );
}
