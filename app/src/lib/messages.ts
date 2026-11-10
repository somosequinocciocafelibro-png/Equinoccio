const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Tu sesión terminó. Entra de nuevo.",
  FORBIDDEN: "Tu usuario no tiene permiso para hacer esto.",
  OPEN_TICKETS: "Hay cuentas abiertas. Cóbralas o anúlalas antes de cerrar el día.",
  CASH_REQUIRED: "Escribe el efectivo contado en caja.",
  NOTE_REQUIRED: "Hay diferencias: escribe una nota para poder cerrar.",
  ALREADY_CLOSED: "Ese día ya está cerrado.",
  NOT_CLOSED: "Ese día no está cerrado.",
  REASON_REQUIRED: "Escribe el motivo.",
  SERVICE_LOCKED: "El servicio ya no se puede cambiar: hay pagos registrados.",
  DAY_CLOSED: "El día ya está cerrado. Un administrador debe reabrirlo para seguir.",
  TICKET_NOT_OPEN: "La cuenta ya no está abierta.",
  TICKET_NOT_FOUND: "No se encontró la cuenta.",
  TABLE_NOT_FOUND: "No se encontró la mesa.",
  PRODUCT_NOT_FOUND: "El producto no existe o está desactivado.",
  EXTRA_NOT_FOUND: "El extra no existe o está desactivado.",
  LINE_NOT_FOUND: "No se encontró el producto en la cuenta.",
  PAYMENT_NOT_FOUND: "No se encontró el pago.",
  INVALID_QTY: "La cantidad no es válida.",
  INVALID_DAY: "La fecha no es válida.",
  INVALID_AMOUNT: "Los montos deben ser pesos enteros, sin decimales ni negativos.",
  AMOUNT_ZERO: "Escribe un monto mayor a cero.",
  EXCEEDS_BALANCE: "El monto no puede ser mayor al saldo.",
  INVALID_MEDIO: "Ese medio de pago no existe.",
  CASH_SHORT: "El efectivo recibido es menor al monto del pago.",
  EMPTY_TICKET: "La cuenta no tiene productos.",
  NAME_TAKEN: "Ya existe un producto con ese nombre.",
  NAME_REQUIRED: "Escribe el nombre.",
  INVALID_CAPACITY: "Las personas deben ser un número entero mayor a cero.",
  TABLE_IN_USE: "Esa mesa tiene una cuenta abierta. Cóbrala o anúlala antes de desactivarla.",
  INVALID_PCT: "El porcentaje debe estar entre 0 y 30.",
};

export const KNOWN_ERROR_CODES = Object.keys(MESSAGES);

export function errorMessage(code: string): string {
  return MESSAGES[code] ?? "Algo salió mal. Inténtalo de nuevo.";
}
