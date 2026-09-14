import { parseEstadoCaptacion, type EstadoCaptacion } from "./estados";

export type KpiCaptacion = {
  asignadas: number;
  sinTrabajar: number;
  enCurso: number;
  conPropiedad: number;
  visitas: number;
  conversionPct: number;
};

export function kpisCaptacion(input: {
  estados: Array<EstadoCaptacion | string>;
  conPropiedad: number;
  visitas: number;
}): KpiCaptacion {
  const estados = input.estados.map(parseEstadoCaptacion);
  const asignadas = estados.length;
  const sinTrabajar = estados.filter((estado) => estado === "nueva").length;
  const enCurso = estados.filter((estado) =>
    ["contactar", "propietario_localizado", "visita", "mandato"].includes(estado)
  ).length;
  const conversionPct = asignadas === 0 ? 0 : Math.round((input.conPropiedad / asignadas) * 100);
  return {
    asignadas,
    sinTrabajar,
    enCurso,
    conPropiedad: input.conPropiedad,
    visitas: input.visitas,
    conversionPct,
  };
}

export type KpiPorComercial = {
  comercialId: string;
  nombre: string;
  asignadas: number;
  conPropiedad: number;
  conversionPct: number;
};

export function kpisPorComercial(
  filas: Array<{ comercialId: string; nombre: string; propertyId: string | null }>
): KpiPorComercial[] {
  const mapa = new Map<string, KpiPorComercial>();
  for (const fila of filas) {
    const actual = mapa.get(fila.comercialId) ?? {
      comercialId: fila.comercialId,
      nombre: fila.nombre,
      asignadas: 0,
      conPropiedad: 0,
      conversionPct: 0,
    };
    actual.asignadas += 1;
    if (fila.propertyId) actual.conPropiedad += 1;
    mapa.set(fila.comercialId, actual);
  }
  return [...mapa.values()]
    .map((item) => ({
      ...item,
      conversionPct: item.asignadas === 0 ? 0 : Math.round((item.conPropiedad / item.asignadas) * 100),
    }))
    .sort((a, b) => b.asignadas - a.asignadas);
}
