import { ESTADO_CITA_LABEL, type EstadoCita } from "@/lib/citas/citas";
import { ESTADO_PARTE_LABELS } from "@/lib/partes-visita";

export type ParteVisitaMini = {
  id: string;
  fecha_visita: string | null;
  visitante_nombre: string | null;
  estado: "borrador" | "pendiente_firma" | "firmado";
  cliente_id?: string | null;
  cita_id?: string | null;
  clientes?: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
};

export type CitaVisitaMini = {
  id: string;
  empieza: string;
  estado: string;
  titulo: string | null;
  cliente_id?: string | null;
  clientes?: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
};

export type VisitanteInmueble = {
  key: string;
  fecha: string | null;
  nombre: string;
  estadoLabel: string;
  clienteId: string | null;
  parteId: string | null;
  citaId: string | null;
};

function unoCliente(
  clientes: ParteVisitaMini["clientes"] | CitaVisitaMini["clientes"]
): { id: string; nombre: string } | null {
  if (!clientes) return null;
  return Array.isArray(clientes) ? (clientes[0] ?? null) : clientes;
}

function diaDe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

/**
 * Une partes y citas de visita del mismo inmueble.
 * Si el parte tiene cita_id, se fusiona con esa cita (una fila).
 */
export function unificarVisitantesInmueble(
  partes: ParteVisitaMini[],
  citas: CitaVisitaMini[]
): VisitanteInmueble[] {
  const porCita = new Map<string, ParteVisitaMini>();
  const sueltos: ParteVisitaMini[] = [];
  for (const p of partes) {
    if (p.cita_id) porCita.set(p.cita_id, p);
    else sueltos.push(p);
  }

  const out: VisitanteInmueble[] = [];
  const citasUsadas = new Set<string>();

  for (const c of citas) {
    const parte = porCita.get(c.id);
    if (parte) citasUsadas.add(c.id);
    const cliParte = parte ? unoCliente(parte.clientes) : null;
    const cliCita = unoCliente(c.clientes);
    const clienteId = parte?.cliente_id || c.cliente_id || cliParte?.id || cliCita?.id || null;
    const nombre =
      cliParte?.nombre ||
      cliCita?.nombre ||
      parte?.visitante_nombre?.trim() ||
      c.titulo?.trim() ||
      "Visitante";
    const fecha = parte?.fecha_visita || diaDe(c.empieza);
    const estadoLabel = parte
      ? ESTADO_PARTE_LABELS[parte.estado] ?? parte.estado
      : ESTADO_CITA_LABEL[c.estado as EstadoCita] ?? c.estado;
    out.push({
      key: parte ? `parte-${parte.id}` : `cita-${c.id}`,
      fecha,
      nombre,
      estadoLabel,
      clienteId,
      parteId: parte?.id ?? null,
      citaId: c.id,
    });
  }

  for (const [citaId, parte] of porCita) {
    if (citasUsadas.has(citaId)) continue;
    const cli = unoCliente(parte.clientes);
    out.push({
      key: `parte-${parte.id}`,
      fecha: parte.fecha_visita,
      nombre: cli?.nombre || parte.visitante_nombre?.trim() || "Visitante",
      estadoLabel: ESTADO_PARTE_LABELS[parte.estado] ?? parte.estado,
      clienteId: parte.cliente_id || cli?.id || null,
      parteId: parte.id,
      citaId,
    });
  }

  for (const parte of sueltos) {
    const cli = unoCliente(parte.clientes);
    out.push({
      key: `parte-${parte.id}`,
      fecha: parte.fecha_visita,
      nombre: cli?.nombre || parte.visitante_nombre?.trim() || "Visitante",
      estadoLabel: ESTADO_PARTE_LABELS[parte.estado] ?? parte.estado,
      clienteId: parte.cliente_id || cli?.id || null,
      parteId: parte.id,
      citaId: null,
    });
  }

  return out;
}

export function partirVisitantesPorFecha(
  visitas: VisitanteInmueble[],
  hoy: string
): { proximas: VisitanteInmueble[]; historial: VisitanteInmueble[] } {
  const proximas: VisitanteInmueble[] = [];
  const historial: VisitanteInmueble[] = [];
  for (const v of visitas) {
    if (!v.fecha || v.fecha >= hoy) proximas.push(v);
    else historial.push(v);
  }
  proximas.sort((a, b) => (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999"));
  historial.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
  return { proximas, historial };
}
