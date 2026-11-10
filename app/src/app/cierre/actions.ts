"use server";

import { revalidatePath } from "next/cache";
import type { Medio } from "@/domain/types";
import { requireRole } from "@/server/auth";
import { closeDay, reopenDay } from "@/server/closings";
import { getDb } from "@/server/db";
import { safe } from "@/server/safe";
import { voidTicket } from "@/server/tickets";

const refresh = () => {
  revalidatePath("/cierre");
  revalidatePath("/mesas", "layout");
};

export async function closeDayAction(i: {
  day: string;
  base: number;
  real: Partial<Record<Medio, number | null>>;
  note: string;
}) {
  const { userId } = await requireRole("closeDay");
  return safe(async () => {
    await closeDay(getDb(), { ...i, userId });
    refresh();
    return {};
  });
}

export async function reopenDayAction(i: { day: string; reason: string }) {
  const { userId } = await requireRole("reopenDay");
  return safe(async () => {
    await reopenDay(getDb(), { ...i, userId });
    refresh();
    return {};
  });
}

export async function voidTicketAction(i: { ticketId: string; reason: string }) {
  const { userId } = await requireRole("void");
  return safe(async () => {
    await voidTicket(getDb(), { ...i, userId });
    refresh();
    return {};
  });
}
