import { ESTADO_CITA_LABEL, TIPO_CITA_LABEL, type EstadoCita, type TipoCita } from "@/lib/citas/citas";
import { ESTADO_PARTE_LABELS } from "@/lib/partes-visita";

export type TipoHistorialCliente =
  | "cita"
  | "tarea"
  | "inmueble"
  | "demanda"
  | "factura"
  | "presupuesto"
  | "parte";

export type ItemHistorialCliente = {
  id: string;
  tipo: TipoHistorialCliente;
  fecha: string;
  titulo: string;
  meta: string;
  href: string;
};

const TIPO_LABEL: Record<TipoHistorialCliente, string> = {
  cita: "Agenda",
  tarea: "Tarea",
  inmueble: "Inmueble",
  demanda: "Demanda",
  factura: "Factura",
  presupuesto: "Presupuesto",
  parte: "Parte de visita",
};

export function etiquetaTipoHistorial(tipo: TipoHistorialCliente): string {
  return TIPO_LABEL[tipo];
}

export function ordenarHistorial(items: ItemHistorialCliente[]): ItemHistorialCliente[] {
  return [...items].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function itemCita(row: {
  id: string;
  tipo: string;
  titulo: string;
  empieza: string;
  estado: string;
  motivo_anulacion?: string | null;
  lugar?: string | null;
}): ItemHistorialCliente {
  const tipoLabel = TIPO_CITA_LABEL[row.tipo as TipoCita] ?? row.tipo;
  const estadoLabel = ESTADO_CITA_LABEL[row.estado as EstadoCita] ?? row.estado;
  const motivo = row.estado === "cancelada" && row.motivo_anulacion?.trim() ? ` · ${row.motivo_anulacion.trim()}` : "";
  return {
    id: `cita-${row.id}`,
    tipo: "cita",
    fecha: row.empieza,
    titulo: row.titulo || tipoLabel,
    meta: [tipoLabel, estadoLabel, row.lugar?.trim() || null].filter(Boolean).join(" · ") + motivo,
    href: `/calendario?cita=${row.id}`,
  };
}

export function itemTarea(row: {
  id: string;
  titulo: string;
  vence: string | null;
  hora?: string | null;
  estado: string;
  created_at?: string | null;
}): ItemHistorialCliente {
  const fecha = row.vence
    ? `${row.vence}T${(row.hora || "12:00").slice(0, 5)}:00`
    : row.created_at || new Date(0).toISOString();
  return {
    id: `tarea-${row.id}`,
    tipo: "tarea",
    fecha,
    titulo: row.titulo,
    meta: row.estado === "hecha" ? "Hecha" : row.estado === "esperando" ? "Esperando" : "Pendiente",
    href: `/tareas?tarea=${row.id}`,
  };
}

export function itemInmueble(row: {
  id: string;
  titulo: string | null;
  direccion: string | null;
  localidad: string | null;
  tipo_operacion: string;
  estado: string;
  created_at?: string | null;
  updated_at?: string | null;
}): ItemHistorialCliente {
  return {
    id: `inmueble-${row.id}`,
    tipo: "inmueble",
    fecha: row.updated_at || row.created_at || new Date(0).toISOString(),
    titulo: row.titulo || row.direccion || row.localidad || "Inmueble",
    meta: [row.tipo_operacion, row.estado, row.localidad].filter(Boolean).join(" · "),
    href: `/propiedades/${row.id}`,
  };
}

export function itemDemanda(row: {
  id: string;
  tipo_operacion: string;
  estado: string;
  zonas: string[] | null;
  updated_at?: string | null;
  created_at?: string | null;
}): ItemHistorialCliente {
  return {
    id: `demanda-${row.id}`,
    tipo: "demanda",
    fecha: row.updated_at || row.created_at || new Date(0).toISOString(),
    titulo: `Busca ${row.tipo_operacion}`,
    meta: [row.estado, ...(row.zonas ?? []).slice(0, 2)].filter(Boolean).join(" · "),
    href: `/demandas/${row.id}`,
  };
}

export function itemFactura(row: {
  id: string;
  numero: string;
  estado: string;
  created_at?: string | null;
}): ItemHistorialCliente {
  return {
    id: `factura-${row.id}`,
    tipo: "factura",
    fecha: row.created_at || new Date(0).toISOString(),
    titulo: row.numero,
    meta: row.estado,
    href: `/facturas/${row.id}`,
  };
}

export function itemPresupuesto(row: {
  id: string;
  numero: string;
  estado: string;
  created_at?: string | null;
}): ItemHistorialCliente {
  return {
    id: `presupuesto-${row.id}`,
    tipo: "presupuesto",
    fecha: row.created_at || new Date(0).toISOString(),
    titulo: row.numero,
    meta: row.estado,
    href: `/presupuestos/${row.id}`,
  };
}

export function itemParte(row: {
  id: string;
  inmueble_direccion: string | null;
  fecha_visita: string | null;
  estado: string;
  created_at?: string | null;
}): ItemHistorialCliente {
  const estado =
    ESTADO_PARTE_LABELS[row.estado as keyof typeof ESTADO_PARTE_LABELS] ?? row.estado;
  return {
    id: `parte-${row.id}`,
    tipo: "parte",
    fecha: row.fecha_visita
      ? `${row.fecha_visita}T12:00:00`
      : row.created_at || new Date(0).toISOString(),
    titulo: row.inmueble_direccion || "Parte de visita",
    meta: estado,
    href: `/partes-visita/${row.id}`,
  };
}
