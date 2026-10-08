import { TIPO_INMUEBLE_LABEL, type TipoInmueble } from "@/lib/inmuebles/catalogo";
import { TIPO_OPERACION_DEMANDA_LABEL, type TipoOperacionDemanda } from "@/lib/demandas/matching";
import { formatEuro } from "@/lib/ui/estados-vista";

export type CheckCruce = { ok: boolean; label: string; near: boolean };

export type EvaluacionCruce = {
  checks: CheckCruce[];
  passed: number;
  total: number;
  perfect: boolean;
  near: boolean;
};

export type DemandaParaCruce = {
  tipoOperacion: string;
  tiposInmueble: string[];
  presupuestoMax: number | null;
  zonas: string[];
  habitacionesMin: number | null;
  superficieMin: number | null;
  superficieMax: number | null;
};

export type InmuebleParaCruce = {
  tipoOperacion: string | null;
  tipoInmueble: string | null;
  localidad: string | null;
  codigoPostal?: string | null;
  precio: number | null;
  superficie: number | null;
  habitaciones: number | null;
};

export type EstadoAsignacion = "pending" | "sent" | "interested" | "visit";

const MOTIVOS_DESCARTE = ["Demasiado caro", "Zona que no quiere", "Ya lo conoce", "No le gusta", "Otro motivo"] as const;
export const MOTIVOS_DESCARTE_CRUCE = MOTIVOS_DESCARTE;

function normalizar(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function operacionOk(demanda: string, inmueble: string | null): boolean {
  const d = normalizar(demanda);
  const i = normalizar(inmueble);
  if (d === "ambos" || i === "ambos") return true;
  if (d === "compra") return i === "venta" || i === "ambos";
  if (d === "alquiler") return i === "alquiler" || i === "ambos";
  return d === i;
}

function etiquetaTipo(tipo: string | null | undefined): string {
  if (!tipo) return "Sin tipo";
  return TIPO_INMUEBLE_LABEL[tipo as TipoInmueble] ?? tipo;
}

function etiquetaOperacion(tipo: string): string {
  return TIPO_OPERACION_DEMANDA_LABEL[tipo as TipoOperacionDemanda] ?? tipo;
}

function zonaOk(zonas: string[], inmueble: InmuebleParaCruce): boolean {
  const localidad = normalizar(inmueble.localidad);
  const cp = normalizar(inmueble.codigoPostal);
  return zonas.some((zona) => {
    const z = normalizar(zona);
    if (!z) return false;
    return localidad.includes(z) || (localidad && z.includes(localidad)) || cp === z;
  });
}

function numero(valor: number | string | null | undefined): number | null {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Encaje de un inmueble con una demanda. «Casi» = operación y tipo bien, y un solo fallo leve. */
export function evaluarCruce(inmueble: InmuebleParaCruce, demanda: DemandaParaCruce): EvaluacionCruce {
  const checks: CheckCruce[] = [];
  const add = (ok: boolean, label: string, near = false) => checks.push({ ok, label, near: !ok && near });

  const opOk = operacionOk(demanda.tipoOperacion, inmueble.tipoOperacion);
  add(opOk, opOk ? etiquetaOperacion(demanda.tipoOperacion) : `${etiquetaTipoOperacionInmueble(inmueble.tipoOperacion)} (busca ${etiquetaOperacion(demanda.tipoOperacion).toLowerCase()})`);

  const pideTipo = demanda.tiposInmueble.length > 0;
  const tipoOk = !pideTipo || demanda.tiposInmueble.some((tipo) => normalizar(tipo) === normalizar(inmueble.tipoInmueble));
  if (pideTipo) {
    const pedido = demanda.tiposInmueble.map((tipo) => etiquetaTipo(tipo)).join(", ");
    add(tipoOk, tipoOk ? etiquetaTipo(inmueble.tipoInmueble) : `${etiquetaTipo(inmueble.tipoInmueble)} (busca ${pedido.toLowerCase()})`);
  }

  const max = numero(demanda.presupuestoMax);
  if (max != null) {
    const precio = numero(inmueble.precio);
    if (precio == null) add(false, "Sin precio");
    else {
      const over = precio - max;
      add(over <= 0, over <= 0 ? "En presupuesto" : `+${formatEuro(over)} sobre presupuesto`, over > 0 && over <= max * 0.1);
    }
  }

  if (demanda.zonas.length > 0) {
    const ok = zonaOk(demanda.zonas, inmueble);
    add(ok, ok ? `Zona ${inmueble.localidad || demanda.zonas[0]}` : "Fuera de zona");
  }

  const hab = numero(demanda.habitacionesMin);
  if (hab != null) {
    const rooms = numero(inmueble.habitaciones);
    if (rooms == null) add(false, "Sin habitaciones");
    else add(rooms >= hab, rooms >= hab ? `${rooms} hab` : `Solo ${rooms} hab (pide ${hab})`, rooms === hab - 1);
  }

  const minM = numero(demanda.superficieMin);
  const maxM = numero(demanda.superficieMax);
  const m2 = numero(inmueble.superficie);
  if (minM != null || maxM != null) {
    if (m2 == null) add(false, "Sin superficie");
    else if (minM != null && m2 < minM) add(false, `Solo ${m2} m² (pide ${minM})`, m2 >= minM * 0.9);
    else if (maxM != null && m2 > maxM) add(false, `${m2} m² (máximo ${maxM})`);
    else add(true, `${m2} m²`);
  }

  const failed = checks.filter((check) => !check.ok);
  const perfect = failed.length === 0;
  const near = !perfect && opOk && tipoOk && failed.length === 1 && failed[0]!.near;
  return { checks, passed: checks.length - failed.length, total: checks.length, perfect, near };
}

function etiquetaTipoOperacionInmueble(tipo: string | null): string {
  const n = normalizar(tipo);
  if (n === "venta") return "Venta";
  if (n === "alquiler") return "Alquiler";
  if (n === "ambos") return "Venta y alquiler";
  return tipo || "Sin operación";
}

export function precioDeCruce(demandaOp: string, venta: number | string | null | undefined, alquiler: number | string | null | undefined): number | null {
  const d = normalizar(demandaOp);
  if (d === "alquiler") return numero(alquiler);
  if (d === "compra") return numero(venta);
  return numero(venta) ?? numero(alquiler);
}

export function ordenarCruce<T extends { isNew?: boolean; precio: number | null }>(filas: T[], orden: "recent" | "price"): T[] {
  const precio = (fila: T) => fila.precio ?? Number.MAX_SAFE_INTEGER;
  const copia = [...filas];
  if (orden === "price") return copia.sort((a, b) => precio(a) - precio(b));
  return copia.sort((a, b) => Number(Boolean(b.isNew)) - Number(Boolean(a.isNew)) || precio(a) - precio(b));
}

export function estadoAsignacionDe(estado: string): EstadoAsignacion | null {
  if (estado === "propuesto") return "pending";
  if (estado === "presentado") return "sent";
  if (estado === "oferta") return "interested";
  if (estado === "visitado") return "visit";
  return null;
}

export function estadoDbDe(status: EstadoAsignacion): "propuesto" | "presentado" | "oferta" | "visitado" {
  if (status === "pending") return "propuesto";
  if (status === "sent") return "presentado";
  if (status === "interested") return "oferta";
  return "visitado";
}
