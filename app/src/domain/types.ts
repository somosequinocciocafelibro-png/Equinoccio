export type Medio = "efectivo" | "transferencia" | "bre_b" | "bold";
export type PaymentMedio = Medio | "sin_medio";
export type TicketStatus = "abierto" | "cerrado" | "anulado";

export const MEDIOS: readonly Medio[] = ["efectivo", "transferencia", "bre_b", "bold"];

export interface Extra {
  id: string;
  name: string;
  delta: number;
}

export interface Line {
  id: string;
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  extras: Extra[];
}

export interface Payment {
  id: string;
  medio: PaymentMedio;
  received: number;
  applied: number;
  createdAt: string;
}

export interface Service {
  enabled: boolean;
  custom: number | null;
  frozenAmount: number | null;
}

export interface Ticket {
  id: string;
  tableId: string;
  salon: string | null;
  tableName: string;
  status: TicketStatus;
  openedAt: string;
  closedAt: string | null;
  lines: Line[];
  payments: Payment[];
  service: Service;
  voidReason: string | null;
  /** Usuario que abrió la cuenta (para saber quién vendió). */
  openedBy?: string | null;
}
