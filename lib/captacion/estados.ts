export const ESTADOS_CAPTACION = [
  "nueva",
  "contactar",
  "propietario_localizado",
  "visita",
  "mandato",
  "en_stock",
  "descartada",
  "no_localizable",
] as const;

export type EstadoCaptacion = (typeof ESTADOS_CAPTACION)[number];

export const ESTADO_CAPTACION_LABEL: Record<EstadoCaptacion, string> = {
  nueva: "Nueva",
  contactar: "Por contactar",
  propietario_localizado: "Propietario localizado",
  visita: "Visita",
  mandato: "Mandato",
  en_stock: "En stock",
  descartada: "Descartada",
  no_localizable: "No localizable",
};

export const FILTROS_BANDEJA_CAPTACION = [
  { value: "TODAS", label: "Todas" },
  { value: "SIN_TRABAJAR", label: "Sin trabajar" },
  { value: "EN_CURSO", label: "En curso" },
  { value: "CON_PROPIEDAD", label: "Con propiedad" },
  { value: "CERRADAS", label: "Cerradas" },
] as const;

export type FiltroBandejaCaptacion = (typeof FILTROS_BANDEJA_CAPTACION)[number]["value"];

const EN_CURSO: ReadonlySet<EstadoCaptacion> = new Set([
  "contactar",
  "propietario_localizado",
  "visita",
  "mandato",
]);

const CERRADAS: ReadonlySet<EstadoCaptacion> = new Set(["descartada", "no_localizable"]);

export function esEstadoCaptacion(valor: unknown): valor is EstadoCaptacion {
  return typeof valor === "string" && (ESTADOS_CAPTACION as readonly string[]).includes(valor);
}

export function parseEstadoCaptacion(valor: unknown): EstadoCaptacion {
  return esEstadoCaptacion(valor) ? valor : "nueva";
}

export function diasDesdeAsignacion(assignedAt: string | null | undefined, hoy: string): number | null {
  if (!assignedAt) return null;
  const inicio = new Date(`${assignedAt.slice(0, 10)}T12:00:00`);
  const actual = new Date(`${hoy.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(actual.getTime())) return null;
  return Math.max(0, Math.round((actual.getTime() - inicio.getTime()) / 86_400_000));
}

export function textoAging(dias: number | null): string {
  if (dias == null) return "";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "1 día";
  return `${dias} días`;
}

export function coincideFiltroBandeja(
  estado: EstadoCaptacion,
  filtro: FiltroBandejaCaptacion,
  tienePropiedad: boolean
): boolean {
  if (filtro === "TODAS") return true;
  if (filtro === "SIN_TRABAJAR") return estado === "nueva" && !tienePropiedad;
  if (filtro === "EN_CURSO") return EN_CURSO.has(estado);
  if (filtro === "CON_PROPIEDAD") return tienePropiedad || estado === "en_stock";
  if (filtro === "CERRADAS") return CERRADAS.has(estado);
  return true;
}

export type PipelineCaptacion = {
  fincaReference: string;
  estado: EstadoCaptacion;
  proximaAccion: string | null;
  proximaAccionEn: string | null;
  assignedAt: string | null;
  comercialId: string;
  comercialNombre: string;
  propertyId: string | null;
};

export function recuentoBandejaCaptacion<T extends { estado: EstadoCaptacion; propertyId?: string | null }>(
  items: T[]
): Record<FiltroBandejaCaptacion, number> {
  return {
    TODAS: items.length,
    SIN_TRABAJAR: items.filter((item) => coincideFiltroBandeja(item.estado, "SIN_TRABAJAR", Boolean(item.propertyId)))
      .length,
    EN_CURSO: items.filter((item) => coincideFiltroBandeja(item.estado, "EN_CURSO", Boolean(item.propertyId))).length,
    CON_PROPIEDAD: items.filter((item) =>
      coincideFiltroBandeja(item.estado, "CON_PROPIEDAD", Boolean(item.propertyId))
    ).length,
    CERRADAS: items.filter((item) => coincideFiltroBandeja(item.estado, "CERRADAS", Boolean(item.propertyId))).length,
  };
}

export function alertaDuplicadoFinca(input: {
  asignadaA?: string | null;
  yo?: string | null;
  propertyId?: string | null;
}): { tipo: "asignada" | "propiedad" | null; texto: string | null } {
  if (input.propertyId) {
    return { tipo: "propiedad", texto: "Esta referencia ya es una propiedad del CRM." };
  }
  if (input.asignadaA && input.asignadaA !== input.yo) {
    return { tipo: "asignada", texto: "Esta finca ya está asignada a otro comercial." };
  }
  if (input.asignadaA && input.asignadaA === input.yo) {
    return { tipo: "asignada", texto: "Esta finca ya te está asignada." };
  }
  return { tipo: null, texto: null };
}
