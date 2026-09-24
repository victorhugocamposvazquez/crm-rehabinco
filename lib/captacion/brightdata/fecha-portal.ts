
/**
 * Segmentos comprobados en idealista.com (24 sep 2026):
 * - 24 h: `con-publicado_ultimas-24-horas` (alquiler; el menú de venta no lo lista)
 * - 48 h: `con-publicado_ultimas-48-horas` (filtro más fino de venta)
 * - semana: `con-publicado_ultima-semana`
 * - mes: `con-publicado_ultimo-mes`
 * El segmento va como `/con-publicado_…/`, sin particulares.
 */
export const FILTROS_FECHA = {
  "24h": "publicado_ultimas-24-horas",
  "48h": "publicado_ultimas-48-horas",
  "7d": "publicado_ultima-semana",
  "30d": "publicado_ultimo-mes",
} as const;

export type FiltroFecha = keyof typeof FILTROS_FECHA;
export type PrecisionFecha = FiltroFecha | ">30d" | "exacta";

const RANGO: Record<PrecisionFecha, number> = {
  exacta: 6,
  "24h": 5,
  "48h": 4,
  "7d": 3,
  "30d": 2,
  ">30d": 1,
};

const MARGEN: Record<PrecisionFecha, string> = {
  exacta: "",
  "24h": "±12 horas",
  "48h": "±1 día",
  "7d": "±3 días",
  "30d": "±15 días",
  ">30d": "",
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function esFiltroFecha(valor: string): valor is FiltroFecha {
  return valor in FILTROS_FECHA;
}

export function urlConFiltroFecha(url: string, filtro: FiltroFecha): string {
  const base = url.replace(/\/con-particulares\/?/, "/").replace(/\/$/, "");
  return `${base}/con-${FILTROS_FECHA[filtro]}/`;
}

/** Venta usa 48 h; alquiler, 24 h. El resto de URLs se trata como venta. */
export function filtroDiario(url: string): FiltroFecha {
  return /alquiler-/i.test(url) ? "24h" : "48h";
}

/**
 * En la URL de 48 h de venta: si no estaba en el CRM antes de la pasada completa de ayer,
 * la franja es 24 h (now()-12h). Si ya estaba, 48 h.
 */
export function fechaDeListadoDiario(
  filtro: FiltroFecha,
  ahora: Date,
  opts: { venta: boolean; existiaAntes: boolean }
): { publicado_en_portal: string; publicado_precision: FiltroFecha } {
  if (opts.venta && filtro === "48h") return fechaDeFiltro(opts.existiaAntes ? "48h" : "24h", ahora);
  return fechaDeFiltro(filtro, ahora);
}

export function existiaAntesDePasada(vistoPrimeraVez: string | null | undefined, iniciadaAyer: string | null): boolean {
  if (!vistoPrimeraVez) return false;
  if (!iniciadaAyer) return true;
  return new Date(vistoPrimeraVez).getTime() < new Date(iniciadaAyer).getTime();
}

export function filtroDeListado(url: string | null | undefined): FiltroFecha | null {
  if (!url) return null;
  for (const filtro of Object.keys(FILTROS_FECHA) as FiltroFecha[]) {
    if (url.includes(FILTROS_FECHA[filtro])) return filtro;
  }
  return null;
}

export function fechaDeFiltro(filtro: FiltroFecha, ahora: Date): { publicado_en_portal: string; publicado_precision: FiltroFecha } {
  const horas = filtro === "24h" ? 12 : filtro === "48h" ? 24 : filtro === "7d" ? 84 : 360;
  return {
    publicado_en_portal: new Date(ahora.getTime() - horas * 3600_000).toISOString(),
    publicado_precision: filtro,
  };
}

/** Nunca sustituye una precisión mejor. A igual precisión se queda la fecha que ya había. */
export function fusionarFechaPortal(
  previa: { publicado_en_portal: string | null; publicado_precision: string | null },
  entrante: { publicado_en_portal: string; publicado_precision: PrecisionFecha }
): { publicado_en_portal: string; publicado_precision: PrecisionFecha; escrito: boolean } {
  const rangoPrevio = RANGO[previa.publicado_precision as PrecisionFecha] ?? 0;
  if (rangoPrevio > RANGO[entrante.publicado_precision]) {
    return {
      publicado_en_portal: previa.publicado_en_portal ?? entrante.publicado_en_portal,
      publicado_precision: previa.publicado_precision as PrecisionFecha,
      escrito: false,
    };
  }
  if (rangoPrevio === RANGO[entrante.publicado_precision] && previa.publicado_en_portal) {
    return {
      publicado_en_portal: previa.publicado_en_portal,
      publicado_precision: entrante.publicado_precision,
      escrito: false,
    };
  }
  return { ...entrante, escrito: true };
}

export function esNuevoHoy(
  precision: string | null | undefined,
  publicadoEnPortal: string | null | undefined,
  ahora = new Date()
): boolean {
  if (precision !== "24h" || !publicadoEnPortal) return false;
  const asignada = new Date(new Date(publicadoEnPortal).getTime() + 12 * 3600_000);
  if (Number.isNaN(asignada.getTime())) return false;
  const dia = (fecha: Date) => fecha.toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  return dia(asignada) === dia(ahora);
}

export function textoFechaPortal(
  a: { publicado_en_portal?: string | null; publicado_precision?: string | null; desaparecido_en?: string | null },
  ahora = new Date()
): string | null {
  if (a.desaparecido_en) return null;
  const precision = a.publicado_precision as PrecisionFecha | null | undefined;
  if (!precision || !(precision in RANGO) || !a.publicado_en_portal) {
    return precision === ">30d" ? "Publicado en Idealista: hace más de 30 días" : null;
  }
  if (precision === ">30d") return "Publicado en Idealista: hace más de 30 días";
  const relativo = hace(new Date(a.publicado_en_portal), ahora);
  const margen = MARGEN[precision];
  return margen ? `Publicado en Idealista: ${relativo} (${margen})` : `Publicado en Idealista: ${relativo}`;
}

function hace(fecha: Date, ahora: Date): string {
  const minutos = Math.max(0, Math.round((ahora.getTime() - fecha.getTime()) / 60000));
  if (minutos < 60) return `hace ${Math.max(1, minutos)} ${minutos === 1 ? "minuto" : "minutos"}`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? "hora" : "horas"}`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}

/** «Anuncio actualizado el 3 de marzo» o «23/09/2026». Sin año, el año en curso si no cae en el futuro. */
export function parsearActualizadoIdealista(texto: string, ahora = new Date()): string | null {
  const limpio = texto.replace(/^anuncio actualizado el\s+/i, "").trim();
  const numerica = limpio.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (numerica) return iso(Number(numerica[3]), Number(numerica[2]), Number(numerica[1]));
  const escrita = limpio.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)/i);
  if (!escrita) return null;
  const mes = MESES.indexOf(escrita[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  if (mes < 0) return null;
  let ano = ahora.getFullYear();
  const candidata = new Date(Date.UTC(ano, mes, Number(escrita[1]), 12));
  if (candidata.getTime() > ahora.getTime() + 86400000) ano -= 1;
  return iso(ano, mes + 1, Number(escrita[1]));
}

function iso(ano: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return new Date(Date.UTC(ano, mes - 1, dia, 12)).toISOString();
}
