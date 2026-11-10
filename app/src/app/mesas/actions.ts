"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth";
import { getDb } from "@/server/db";
import { safe } from "@/server/safe";
import type { Medio } from "@/domain/types";
import { addLine, addPayment, openTicket, removePayment, setLineQty, setService, toggleExtra } from "@/server/tickets";

const refresh = () => revalidatePath("/mesas", "layout");

export async function addLineAction(i: { tableId: string; ticketId: string | null; productId: string; qty: number }) {
  const { userId } = await requireRole("sell");
  return safe(async () => {
    const db = getDb();
    const ticketId = i.ticketId ?? (await openTicket(db, { tableId: i.tableId, userId }));
    await addLine(db, { ticketId, productId: i.productId, qty: i.qty });
    refresh();
    return { ticketId };
  });
}

export async function setQtyAction(i: { lineId: string; qty: number }) {
  await requireRole("sell");
  return safe(async () => {
    await setLineQty(getDb(), i);
    refresh();
    return {};
  });
}

export async function setServiceAction(i: { ticketId: string; enabled: boolean; custom: number | null }) {
  await requireRole("charge");
  return safe(async () => {
    await setService(getDb(), i);
    refresh();
    return {};
  });
}

export async function addPaymentAction(i: {
  ticketId: string;
  medio: Medio;
  amount: number | null;
  received: number | null;
  idempotencyKey: string;
}) {
  const { userId } = await requireRole("charge");
  return safe(async () => {
    const r = await addPayment(getDb(), { ...i, userId });
    refresh();
    return r;
  });
}

export async function removePaymentAction(i: { paymentId: string }) {
  await requireRole("charge");
  return safe(async () => {
    await removePayment(getDb(), i);
    refresh();
    return {};
  });
}

export async function toggleExtraAction(i: { lineId: string; extraId: string }) {
  await requireRole("sell");
  return safe(async () => {
    await toggleExtra(getDb(), i);
    refresh();
    return {};
  });
}
