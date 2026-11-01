/** Métricas ligeras por ráfaga (sin PII). Un log JSON al cerrar. */

export type MetricasRafaga = {
  paginas: number;
  errores: number;
  anuncios: number;
  nuevos: number;
  actualizados: number;
  sin_cambios: number;
  ms_total: number;
  ms_descarga: number;
  ms_parseo: number;
  ms_ingesta: number;
  ms_recogida: number;
  omitida?: boolean;
  motivo?: string | null;
};

export function metricasRafagaVacias(): MetricasRafaga {
  return {
    paginas: 0,
    errores: 0,
    anuncios: 0,
    nuevos: 0,
    actualizados: 0,
    sin_cambios: 0,
    ms_total: 0,
    ms_descarga: 0,
    ms_parseo: 0,
    ms_ingesta: 0,
    ms_recogida: 0,
  };
}

export function acumularMetricas(destino: MetricasRafaga, parte: Partial<MetricasRafaga>): void {
  for (const clave of [
    "paginas",
    "errores",
    "anuncios",
    "nuevos",
    "actualizados",
    "sin_cambios",
    "ms_descarga",
    "ms_parseo",
    "ms_ingesta",
    "ms_recogida",
  ] as const) {
    const v = parte[clave];
    if (typeof v === "number" && Number.isFinite(v)) destino[clave] += v;
  }
}

export function logMetricasRafaga(m: MetricasRafaga): void {
  console.info(JSON.stringify({ captacion_rafaga: m }));
}
