export const CANALES_AVISO = [
  {
    id: "visitas",
    label: "Visitas",
    hint: "Citas de visita previstas para hoy.",
  },
  {
    id: "recordatorios",
    label: "Recordatorios",
    hint: "Recordatorios del calendario.",
  },
  {
    id: "agenda",
    label: "Agenda (eventos, llamadas, firmas)",
    hint: "Lo demás del calendario que no es visita ni recordatorio.",
  },
  {
    id: "tareas_hoy",
    label: "Tareas de hoy",
    hint: "Lo que vence hoy.",
  },
  {
    id: "tareas_vencidas",
    label: "Tareas vencidas",
    hint: "Lo que se quedó de días anteriores.",
  },
  {
    id: "menciones",
    label: "Menciones en tareas",
    hint: "Cuando alguien te nombra con @ en un comentario.",
  },
  {
    id: "partes",
    label: "Partes sin firmar",
    hint: "Actas pendientes de que el visitante firme.",
  },
] as const;

export type CanalAviso = (typeof CANALES_AVISO)[number]["id"];

export type PrefsAviso = Record<CanalAviso, boolean>;

export const PREFS_AVISO_DEFAULT: PrefsAviso = {
  visitas: true,
  recordatorios: true,
  agenda: true,
  tareas_hoy: true,
  tareas_vencidas: true,
  menciones: true,
  partes: true,
};

export const SELECT_PREFS_AVISO =
  "visitas, recordatorios, agenda, tareas_hoy, tareas_vencidas, menciones, partes";

export function prefsCompletas(row: Partial<PrefsAviso> | null | undefined): PrefsAviso {
  return {
    visitas: row?.visitas ?? PREFS_AVISO_DEFAULT.visitas,
    recordatorios: row?.recordatorios ?? PREFS_AVISO_DEFAULT.recordatorios,
    agenda: row?.agenda ?? PREFS_AVISO_DEFAULT.agenda,
    tareas_hoy: row?.tareas_hoy ?? PREFS_AVISO_DEFAULT.tareas_hoy,
    tareas_vencidas: row?.tareas_vencidas ?? PREFS_AVISO_DEFAULT.tareas_vencidas,
    menciones: row?.menciones ?? PREFS_AVISO_DEFAULT.menciones,
    partes: row?.partes ?? PREFS_AVISO_DEFAULT.partes,
  };
}

export function canalDeTipo(tipo: string): CanalAviso {
  if (tipo === "visita") return "visitas";
  if (tipo === "recordatorio") return "recordatorios";
  if (tipo === "tarea") return "tareas_hoy";
  if (tipo === "tarea-vencida") return "tareas_vencidas";
  if (tipo === "mencion") return "menciones";
  if (tipo === "parte") return "partes";
  return "agenda";
}

export function itemPermitido(tipo: string, prefs: PrefsAviso): boolean {
  return prefs[canalDeTipo(tipo)] !== false;
}
