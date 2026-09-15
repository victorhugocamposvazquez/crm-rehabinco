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
  activa: "#0B7461",
  pausada: "#B98A16",
  cubierta: "#2B4A8A",
  cerrada: "#B3ADA3",
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
  estado?: string | null;
};

export type ResultadoMatching = {
  ok: boolean;
  puntuacion: number;
  motivos: string[];
};

function normalizar(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function operacionCompatible(demanda: string, inmueble: string | null): boolean {
  const d = normalizar(demanda);
  const i = normalizar(inmueble);
  if (d === "ambos" || i === "ambos") return true;
  if (d === "compra") return i === "venta" || i === "ambos";
  if (d === "alquiler") return i === "alquiler" || i === "ambos";
  return d === i;
}

function precioDeOperacion(demanda: string, inmueble: InmuebleParaMatching): number | null {
  const d = normalizar(demanda);
  if (d === "alquiler") return inmueble.precioAlquiler;
  if (d === "compra") return inmueble.precioVenta;
  return inmueble.precioVenta ?? inmueble.precioAlquiler;
}

function zonaCoincide(zonas: string[], inmueble: InmuebleParaMatching): boolean {
  if (zonas.length === 0) return true;
  const localidad = normalizar(inmueble.localidad);
  const cp = normalizar(inmueble.codigoPostal);
  return zonas.some((zona) => {
    const z = normalizar(zona);
    if (!z) return false;
    return localidad.includes(z) || z.includes(localidad) || cp === z;
  });
}

export function encajaDemandaInmueble(
  demanda: CriteriosDemanda,
  inmueble: InmuebleParaMatching
): ResultadoMatching {
  const motivos: string[] = [];
  let puntos = 0;

  if (inmueble.estado && inmueble.estado !== "disponible") {
    return { ok: false, puntuacion: 0, motivos: ["El inmueble no está disponible."] };
  }

  if (!operacionCompatible(demanda.tipoOperacion, inmueble.tipoOperacion)) {
    return { ok: false, puntuacion: 0, motivos: ["No coincide la operación (compra/alquiler)."] };
  }
  puntos += 20;
  motivos.push("Operación compatible");

  if (demanda.tiposInmueble.length > 0) {
    const tipo = normalizar(inmueble.tipoInmueble);
    if (!demanda.tiposInmueble.some((item) => normalizar(item) === tipo)) {
      return { ok: false, puntuacion: 0, motivos: ["El tipo de inmueble no está entre los pedidos."] };
    }
    puntos += 20;
    motivos.push("Tipo de inmueble");
  }

  if (!zonaCoincide(demanda.zonas, inmueble)) {
    return { ok: false, puntuacion: 0, motivos: ["La zona no coincide."] };
  }
  if (demanda.zonas.length > 0) {
    puntos += 20;
    motivos.push("Zona");
  }

  const precio = precioDeOperacion(demanda.tipoOperacion, inmueble);
  if (demanda.presupuestoMax != null && precio != null) {
    const techo = demanda.presupuestoMax * 1.1;
    if (precio > techo) {
      return { ok: false, puntuacion: 0, motivos: ["El precio supera el presupuesto (+10 %)."] };
    }
    puntos += 15;
    motivos.push("Precio dentro de presupuesto");
    if (precio <= demanda.presupuestoMax) {
      puntos += Math.round(((demanda.presupuestoMax - precio) / demanda.presupuestoMax) * 15);
    }
  } else if (demanda.presupuestoMin != null && precio != null && precio >= demanda.presupuestoMin) {
    puntos += 10;
  }

  const superficie = inmueble.superficie;
  if (demanda.superficieMin != null && superficie != null && superficie < demanda.superficieMin) {
    return { ok: false, puntuacion: 0, motivos: ["La superficie es inferior al mínimo."] };
  }
  if (demanda.superficieMin != null && superficie != null) {
    puntos += 10;
    motivos.push("Superficie");
  }

  if (demanda.habitacionesMin != null && (inmueble.habitaciones ?? 0) < demanda.habitacionesMin) {
    return { ok: false, puntuacion: 0, motivos: ["Faltan habitaciones."] };
  }
  if (demanda.habitacionesMin != null) {
    puntos += 10;
    motivos.push("Habitaciones");
  }

  if (demanda.banosMin != null && (inmueble.banos ?? 0) < demanda.banosMin) {
    return { ok: false, puntuacion: 0, motivos: ["Faltan baños."] };
  }
  if (demanda.banosMin != null) puntos += 5;

  return { ok: true, puntuacion: puntos, motivos };
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
