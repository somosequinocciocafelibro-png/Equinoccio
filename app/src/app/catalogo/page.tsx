import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/server/auth";
import { getDb } from "@/server/db";
import { getServicePct, listAllExtras, listAllProducts, listAllTables } from "@/server/queries";
import { CatalogEditor } from "./catalog-editor";

export const metadata = { title: "Catálogo · Caja Equinoccio" };

export default async function CatalogoPage() {
  const { role, name } = await requireRole("editCatalog");
  const db = getDb();
  const [pct, products, extras, tables] = await Promise.all([
    getServicePct(db),
    listAllProducts(db),
    listAllExtras(db),
    listAllTables(db),
  ]);
  return (
    <AppShell role={role} name={name} active="catalogo">
      <CatalogEditor pct={pct} products={products} extras={extras} tables={tables} />
    </AppShell>
  );
}
