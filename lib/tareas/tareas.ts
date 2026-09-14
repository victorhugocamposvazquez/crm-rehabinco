export const ESTADOS_TAREA = ["pendiente", "hecha"] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];

export const BANDEJAS_TAREA = [
  { value: "VENCIDAS", label: "Vencidas" },
  { value: "HOY", label: "Hoy" },
  { value: "PROXIMAS", label: "Próximas" },
  { value: "SIN_FECHA", label: "Sin fecha" },
  { value: "HECHAS", label: "Hechas" },
] as const;

export type BandejaTarea = (typeof BANDEJAS_TAREA)[number]["value"];

export type TareaOrganizador = {
  id: string;
  titulo: string;
  vence: string | null;
  estado: EstadoTarea | string;
  fincaReference?: string | null;
  propiedadId?: string | null;
  clienteId?: string | null;
};

export function parseEstadoTarea(valor: unknown): EstadoTarea {
  return valor === "hecha" ? "hecha" : "pendiente";
}

export function bandejaDeTarea(vence: string | null | undefined, hoy: string, estado: string): BandejaTarea {
  if (parseEstadoTarea(estado) === "hecha") return "HECHAS";
  const dia = vence?.slice(0, 10) ?? "";
  if (!dia) return "SIN_FECHA";
  if (dia < hoy.slice(0, 10)) return "VENCIDAS";
  if (dia === hoy.slice(0, 10)) return "HOY";
  return "PROXIMAS";
}

export function agruparTareas<T extends { vence?: string | null; estado: string }>(
  tareas: T[],
  hoy: string
): Record<BandejaTarea, T[]> {
  const vacio: Record<BandejaTarea, T[]> = {
    VENCIDAS: [],
    HOY: [],
    PROXIMAS: [],
    SIN_FECHA: [],
    HECHAS: [],
  };
  for (const tarea of tareas) {
    vacio[bandejaDeTarea(tarea.vence, hoy, tarea.estado)].push(tarea);
  }
  const porVence = (a: T, b: T) => (a.vence ?? "").localeCompare(b.vence ?? "");
  vacio.VENCIDAS.sort(porVence);
  vacio.HOY.sort(porVence);
  vacio.PROXIMAS.sort(porVence);
  vacio.HECHAS.sort((a, b) => porVence(b, a));
  return vacio;
}

export function recuentoTareas<T extends { vence?: string | null; estado: string }>(
  tareas: T[],
  hoy: string
): Record<BandejaTarea, number> {
  const grupos = agruparTareas(tareas, hoy);
  return {
    VENCIDAS: grupos.VENCIDAS.length,
    HOY: grupos.HOY.length,
    PROXIMAS: grupos.PROXIMAS.length,
    SIN_FECHA: grupos.SIN_FECHA.length,
    HECHAS: grupos.HECHAS.length,
  };
}
