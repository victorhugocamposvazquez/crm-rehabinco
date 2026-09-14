export const ESTADOS_TAREA = ["pendiente", "esperando", "hecha"] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];

export const BANDEJAS_TAREA = [
  { value: "VENCIDAS", label: "Vencidas" },
  { value: "HOY", label: "Hoy" },
  { value: "PROXIMAS", label: "Próximas" },
  { value: "SIN_FECHA", label: "Sin fecha" },
  { value: "ESPERANDO", label: "Esperando" },
  { value: "HECHAS", label: "Hechas" },
] as const;

export type BandejaTarea = (typeof BANDEJAS_TAREA)[number]["value"];

export type ColumnaTarea = "hoy" | "curso" | "espera" | "hecha";

export const COLUMNAS_TAREA: { id: ColumnaTarea; label: string; dot: string; hint?: string }[] = [
  { id: "hoy", label: "Hoy", dot: "#C0644F", hint: "vencidas + hoy" },
  { id: "curso", label: "Esta semana", dot: "#B98A16" },
  { id: "espera", label: "Esperando", dot: "#8579C4", hint: "terceros" },
  { id: "hecha", label: "Hechas", dot: "#0B7461", hint: "últimos 7 días" },
];

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
  if (valor === "hecha") return "hecha";
  if (valor === "esperando") return "esperando";
  return "pendiente";
}

export function bandejaDeTarea(vence: string | null | undefined, hoy: string, estado: string): BandejaTarea {
  const parsed = parseEstadoTarea(estado);
  if (parsed === "hecha") return "HECHAS";
  if (parsed === "esperando") return "ESPERANDO";
  const dia = vence?.slice(0, 10) ?? "";
  if (!dia) return "SIN_FECHA";
  if (dia < hoy.slice(0, 10)) return "VENCIDAS";
  if (dia === hoy.slice(0, 10)) return "HOY";
  return "PROXIMAS";
}

export function columnaDeTarea(vence: string | null | undefined, hoy: string, estado: string): ColumnaTarea {
  const bandeja = bandejaDeTarea(vence, hoy, estado);
  if (bandeja === "VENCIDAS" || bandeja === "HOY") return "hoy";
  if (bandeja === "ESPERANDO") return "espera";
  if (bandeja === "HECHAS") return "hecha";
  return "curso";
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
    ESPERANDO: [],
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
    ESPERANDO: grupos.ESPERANDO.length,
    HECHAS: grupos.HECHAS.length,
  };
}

export function patchAlMoverColumna(
  col: ColumnaTarea,
  hoy: string
): { estado: EstadoTarea; vence?: string | null } {
  if (col === "hecha") return { estado: "hecha" };
  if (col === "espera") return { estado: "esperando" };
  if (col === "hoy") return { estado: "pendiente", vence: hoy };
  const fin = new Date(`${hoy}T12:00:00`);
  fin.setDate(fin.getDate() + 3);
  return { estado: "pendiente", vence: fin.toISOString().slice(0, 10) };
}

/** «Llamar propietario Agra Montes mañana 10:00» → { titulo, vence, hora } */
export function parseTareaRapida(txt: string, hoy = new Date()) {
  const hora = txt.match(/(\d{1,2}:\d{2})/)?.[1] ?? null;
  const manana = /\bmañana\b/i.test(txt);
  const vence = new Date(hoy);
  if (manana) vence.setDate(vence.getDate() + 1);
  return {
    titulo: txt.replace(/\s*(mañana|hoy)?\s*\d{1,2}:\d{2}\s*/i, " ").replace(/\s+/g, " ").trim(),
    vence: vence.toISOString().slice(0, 10),
    hora,
  };
}
