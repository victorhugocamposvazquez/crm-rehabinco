import type { Twin } from "../types";

const TTL_MS = 24 * 60 * 60 * 1000;

export type BorradorNuevaValoracion = {
  savedAt: number;
  userId: string;
  pantalla: string;
  entryTab: string;
  origen: string;
  twin: Twin | null;
  built: unknown;
  historial: string[];
  etiqueta: string;
};

function clave(userId: string) {
  return `avm-valoracion-borrador:${userId}`;
}

export function guardarBorrador(userId: string, data: Omit<BorradorNuevaValoracion, "savedAt" | "userId">) {
  if (typeof window === "undefined") return;
  const payload: BorradorNuevaValoracion = { ...data, userId, savedAt: Date.now() };
  try {
    localStorage.setItem(clave(userId), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function leerBorrador(userId: string): BorradorNuevaValoracion | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(clave(userId));
    if (!raw) return null;
    const data = JSON.parse(raw) as BorradorNuevaValoracion;
    if (data.userId !== userId) return null;
    if (Date.now() - data.savedAt > TTL_MS) {
      localStorage.removeItem(clave(userId));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function descartarBorrador(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(clave(userId));
}
