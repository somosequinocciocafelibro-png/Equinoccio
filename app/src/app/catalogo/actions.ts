"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth";
import { setServicePct, upsertExtra, upsertProduct, upsertTable, type ExtraInput, type ProductInput, type TableInput } from "@/server/catalog";
import { getDb } from "@/server/db";
import { safe } from "@/server/safe";

const refresh = () => {
  revalidatePath("/catalogo");
  revalidatePath("/mesas", "layout");
};

export async function saveProductAction(i: ProductInput) {
  await requireRole("editCatalog");
  return safe(async () => {
    const id = await upsertProduct(getDb(), i);
    refresh();
    return { id };
  });
}

export async function saveExtraAction(i: ExtraInput) {
  await requireRole("editCatalog");
  return safe(async () => {
    const id = await upsertExtra(getDb(), i);
    refresh();
    return { id };
  });
}

export async function saveTableAction(i: TableInput) {
  await requireRole("editCatalog");
  return safe(async () => {
    const id = await upsertTable(getDb(), i);
    refresh();
    return { id };
  });
}

export async function saveServicePctAction(i: { pct: number }) {
  await requireRole("editCatalog");
  return safe(async () => {
    await setServicePct(getDb(), i.pct);
    refresh();
    return {};
  });
}
