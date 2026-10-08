import { evaluarCruce, precioDeCruce, pideAscensor, pideRequisito } from "@/lib/demandas/cruce";

export const TIPOS_OPERACION_DEMANDA = ["compra", "alquiler", "ambos"] as const;
export type TipoOperacionDemanda = (typeof TIPOS_OPERACION_DEMANDA)[number];

export const TIPO_OPERACION_DEMANDA_LABEL: Record<TipoOperacionDemanda, string> = {
  compra: "Compra",
  alquiler: "Alquiler",
  ambos: "Compra y alquiler",
};

export const ESTADOS_DEMANDA = ["activa", "pausada", "cubierta", "cerrada"] as const;
export type EstadoDemanda = (typeof ESTADOS_DEMANDA)[number];

export const ESTADO_DEMANDA_DOT: Record<EstadoDemanda, string> = {
  activa: "var(--foreground)",
  pausada: "var(--amber)",
  cubierta: "var(--blue)",
  cerrada: "var(--text-3)",
};

export const ESTADOS_MATCHING = ["propuesto", "presentado", "descartado", "visitado", "oferta"] as const;
export type EstadoMatching = (typeof ESTADOS_MATCHING)[number];

export const ESTADO_MATCHING_LABEL: Record<EstadoMatching, string> = {
  propuesto: "Propuesto",
  presentado: "Presentado",
  descartado: "Descartado",
  visitado: "Visitado",
  oferta: "Oferta",
};

export type CriteriosDemanda = {
  tipoOperacion: TipoOperacionDemanda | string;
  tiposInmueble: string[];
  zonas: string[];
  presupuestoMin: number | null;
  presupuestoMax: number | null;
  superficieMin: number | null;
  superficieMax: number | null;
  habitacionesMin: number | null;
  banosMin: number | null;
  requisitos?: string | null;
};

export type InmuebleParaMatching = {
  id: string;
  tipoOperacion: string | null;
  tipoInmueble: string | null;
  localidad: string | null;
  codigoPostal: string | null;
  precioVenta: number | null;
  precioAlquiler: number | null;
  superficie: number | null;
  habitaciones: number | null;
  banos: number | null;
  ascensor?: boolean | null;
  garaje?: boolean | null;
  terraza?: boolean | null;
  exterior?: boolean | null;
  estado?: string | null;
  publicado?: boolean | null;
};

export type ResultadoMatching = {
  ok: boolean;
  puntuacion: number;
  motivos: string[];
};

/** Misma ficha que usa el cruce de la demanda: superficie útil y, si no hay, construida. */
export function fichaParaMatching(row: {
  id: string;
  tipo_operacion: string | null;
  tipo_inmueble: string | null;
  localidad: string | null;
  codigo_postal?: string | null;
  precio_venta: number | null;
  precio_alquiler: number | null;
  superficie_m2?: number | null;
  superficie_util?: number | null;
  habitaciones: number | null;
  banos: number | null;
  ascensor?: boolean | null;
  garaje?: boolean | null;
  terraza?: boolean | null;
  exterior?: boolean | null;
  estado?: string | null;
  publicado?: boolean | null;
}): InmuebleParaMatching {
  return {
    id: row.id,
    tipoOperacion: row.tipo_operacion,
    tipoInmueble: row.tipo_inmueble,
    localidad: row.localidad,
    codigoPostal: row.codigo_postal ?? null,
    precioVenta: row.precio_venta,
    precioAlquiler: row.precio_alquiler,
    superficie: row.superficie_util ?? row.superficie_m2 ?? null,
    habitaciones: row.habitaciones,
    banos: row.banos,
    ascensor: row.ascensor ?? null,
    garaje: row.garaje ?? null,
    terraza: row.terraza ?? null,
    exterior: row.exterior ?? null,
    estado: row.estado,
    publicado: row.publicado,
  };
}

export function encajaDemandaInmueble(
  demanda: CriteriosDemanda,
  inmueble: InmuebleParaMatching
): ResultadoMatching {
  if (inmueble.estado && inmueble.estado !== "disponible") {
    return { ok: false, puntuacion: 0, motivos: ["El inmueble no está disponible."] };
  }

  const evaluacion = evaluarCruce(
    {
      tipoOperacion: inmueble.tipoOperacion,
      tipoInmueble: inmueble.tipoInmueble,
      localidad: inmueble.localidad,
      codigoPostal: inmueble.codigoPostal,
      precio: precioDeCruce(demanda.tipoOperacion, inmueble.precioVenta, inmueble.precioAlquiler),
      superficie: inmueble.superficie,
      habitaciones: inmueble.habitaciones,
      banos: inmueble.banos,
      ascensor: inmueble.ascensor ?? null,
      garaje: inmueble.garaje ?? null,
      terraza: inmueble.terraza ?? null,
      exterior: inmueble.exterior ?? null,
    },
    {
      tipoOperacion: demanda.tipoOperacion,
      tiposInmueble: demanda.tiposInmueble,
      presupuestoMin: demanda.presupuestoMin,
      presupuestoMax: demanda.presupuestoMax,
      zonas: demanda.zonas,
      habitacionesMin: demanda.habitacionesMin,
      superficieMin: demanda.superficieMin,
      superficieMax: demanda.superficieMax,
      banosMin: demanda.banosMin,
      pideAscensor: pideAscensor(demanda.requisitos),
      pideGaraje: pideRequisito(demanda.requisitos, "garaje"),
      pideTerraza: pideRequisito(demanda.requisitos, "terraza"),
      pideExterior: pideRequisito(demanda.requisitos, "exterior"),
    }
  );
  const motivos = (evaluacion.perfect ? evaluacion.checks : evaluacion.checks.filter((check) => !check.ok)).map(
    (check) => check.label
  );
  if (!evaluacion.perfect) return { ok: false, puntuacion: 0, motivos };

  const precio = precioDeCruce(demanda.tipoOperacion, inmueble.precioVenta, inmueble.precioAlquiler);
  const max = demanda.presupuestoMax;
  const cerca =
    max != null && precio != null && precio <= max ? Math.round(((max - precio) / max) * 15) : 0;
  return { ok: true, puntuacion: 80 + cerca, motivos };
}

export function matchingDemandas(
  demanda: CriteriosDemanda,
  inmuebles: InmuebleParaMatching[]
): Array<ResultadoMatching & { propiedadId: string }> {
  return inmuebles
    .map((inmueble) => ({ ...encajaDemandaInmueble(demanda, inmueble), propiedadId: inmueble.id }))
    .filter((item) => item.ok)
    .sort((a, b) => b.puntuacion - a.puntuacion);
}

export type DemandaParaMatching = CriteriosDemanda & { id: string };

export function matchingInmuebleDemandas(
  inmueble: InmuebleParaMatching,
  demandas: DemandaParaMatching[]
): Array<ResultadoMatching & { demandaId: string }> {
  return demandas
    .map((demanda) => ({ ...encajaDemandaInmueble(demanda, inmueble), demandaId: demanda.id }))
    .filter((item) => item.ok)
    .sort((a, b) => b.puntuacion - a.puntuacion);
}

export function matchingPasaAVisitado(estado: string | null | undefined): boolean {
  return estado === "propuesto" || estado === "presentado";
}
