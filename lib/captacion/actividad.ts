export type TipoActividadCaptacion =
  | "estado"
  | "nota"
  | "llamada"
  | "tarea"
  | "asignacion"
  | "cita"
  | "propiedad";

export type ActividadCaptacion = {
  id: string;
  fincaReference: string;
  actorId: string | null;
  tipo: TipoActividadCaptacion;
  detalle: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export const TIPOS_ACTIVIDAD: TipoActividadCaptacion[] = [
  "estado",
  "nota",
  "llamada",
  "tarea",
  "asignacion",
  "cita",
  "propiedad",
];

export function esTipoActividad(valor: unknown): valor is TipoActividadCaptacion {
  return typeof valor === "string" && (TIPOS_ACTIVIDAD as string[]).includes(valor);
}

export function detalleCambioEstado(de: string, a: string): string {
  return `Estado: ${de} → ${a}`;
}

export function ordenarActividad<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
