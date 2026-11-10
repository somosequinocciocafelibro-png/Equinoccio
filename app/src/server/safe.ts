import { AppError } from "./errors";

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Para Server Actions: los errores de regla vuelven como datos; cualquier otro error sigue subiendo. */
export async function safe<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.code };
    throw e;
  }
}
