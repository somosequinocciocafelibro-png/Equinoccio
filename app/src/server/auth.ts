import { AppError } from "./errors";

export type Role = "caja" | "admin";
export type Action = "sell" | "charge" | "closeDay" | "viewReports" | "editCatalog" | "void" | "reopenDay";

const CAJA: readonly Action[] = ["sell", "charge", "closeDay"];

/** caja vende, cobra y cierra el día; admin además ve reportes, edita el catálogo, anula y reabre. */
export function canAccess(role: Role | null, action: Action): boolean {
  if (role === "admin") return true;
  if (role === "caja") return CAJA.includes(action);
  return false;
}

export function authorize(
  session: { userId: string } | null,
  role: Role | null,
  action: Action,
): { userId: string; role: Role } {
  if (!session) throw new AppError("UNAUTHENTICATED");
  if (!role || !canAccess(role, action)) throw new AppError("FORBIDDEN");
  return { userId: session.userId, role };
}

/** Lee la sesión de Supabase y el rol de `profiles`; sin sesión redirige a /login, sin permiso lanza FORBIDDEN. */
export async function requireRole(action: Action): Promise<{ userId: string; role: Role; name: string }> {
  const { supabaseServer } = await import("./supabase");
  const { redirect } = await import("next/navigation");
  const { getDb } = await import("./db");
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return redirect("/login");
  const [row] = await getDb().query<{ role: Role; name: string }>(`select role, name from profiles where user_id = $1`, [user.id]);
  return { ...authorize({ userId: user.id }, row?.role ?? null, action), name: row?.name ?? "" };
}
