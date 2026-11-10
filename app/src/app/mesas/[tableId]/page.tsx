import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/server/auth";
import { loadTickets } from "@/server/closings";
import { getDb } from "@/server/db";
import { getServicePct, listExtras, listProducts, listTables } from "@/server/queries";
import { TicketScreen } from "./ticket-screen";

export const metadata = { title: "Cuenta · Caja Equinoccio" };

export default async function TablePage({
  params,
  searchParams,
}: {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<{ ticket?: string }>;
}) {
  const { role } = await requireRole("sell");
  const { tableId } = await params;
  const { ticket: ticketParam } = await searchParams;
  const db = getDb();
  const [tables, products, extras, pct] = await Promise.all([
    listTables(db),
    listProducts(db),
    listExtras(db),
    getServicePct(db),
  ]);
  const table = tables.find((t) => t.id === tableId);
  if (!table) notFound();

  let ticket = null;
  if (ticketParam) {
    ticket = (await loadTickets(db, { ids: [ticketParam] }))[0] ?? null;
  } else if (!table.isTakeout) {
    ticket = (await loadTickets(db, { status: "abierto" })).find((t) => t.tableId === tableId) ?? null;
  }
  if (ticket && (ticket.status !== "abierto" || ticket.tableId !== tableId)) ticket = null;

  return (
    <AppShell role={role} active="mesas">
      <TicketScreen table={table} ticket={ticket} products={products} extras={extras} pct={pct} />
    </AppShell>
  );
}
