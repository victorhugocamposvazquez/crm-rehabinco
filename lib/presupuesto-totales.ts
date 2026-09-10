import type { BajaRepercusion, PropuestaPresupuesto } from "@/lib/presupuesto-propuesta";

export const CAPITULO_REPERCUSION = "00 · Repercusión";
export const AJUSTE_COMERCIAL_DESC = "Ajuste comercial para mantener la oferta inicial";

export type LineaImporte = {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  unidad?: string;
  capitulo?: string | null;
};

export function esLineaRepercusion(capitulo?: string | null) {
  return (capitulo ?? "").trim() === CAPITULO_REPERCUSION;
}

export function importeLinea(l: LineaImporte) {
  return Number(l.cantidad) * Number(l.precioUnitario);
}

export function altasDeLineas<T extends { capitulo?: string | null }>(lineas: T[]) {
  return lineas.filter((l) => !esLineaRepercusion(l.capitulo));
}

export function sumarAltas(lineas: LineaImporte[]) {
  return altasDeLineas(lineas).reduce((acc, l) => acc + importeLinea(l), 0);
}

export function sumarBajas(bajas: BajaRepercusion[]) {
  return bajas.reduce((acc, b) => acc + Math.abs(Number(b.importe) || 0), 0);
}

export function totalesAmpliacion(params: {
  lineas: LineaImporte[];
  bajas: BajaRepercusion[];
  ajusteComercial: number;
  origenTotal: number;
  porcentajeImpuesto: number;
}) {
  const altas = sumarAltas(params.lineas);
  const bajas = sumarBajas(params.bajas);
  const ajuste = Number(params.ajusteComercial) || 0;
  const incrementoNeto = altas - bajas + ajuste;
  const ivaPct = Number(params.porcentajeImpuesto) || 0;
  const ivaIncremento = incrementoNeto * (ivaPct / 100);
  const totalIncremento = incrementoNeto + ivaIncremento;
  const resultante = (Number(params.origenTotal) || 0) + incrementoNeto;
  const ivaResultante = resultante * (ivaPct / 100);
  return {
    altas,
    bajas,
    ajuste,
    incrementoNeto,
    ivaIncremento,
    totalIncremento,
    resultante,
    ivaResultante,
    totalResultante: resultante + ivaResultante,
  };
}

export function lineasParaDb(
  altas: LineaImporte[],
  propuesta: PropuestaPresupuesto
): Array<{
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  unidad: string;
  capitulo: string | null;
}> {
  const out = altas
    .filter((l) => l.descripcion.trim() && Number(l.cantidad) > 0)
    .map((l) => ({
      descripcion: l.descripcion.trim(),
      cantidad: Number(l.cantidad),
      precio_unitario: Number(l.precioUnitario),
      unidad: (l.unidad || "ud").trim() || "ud",
      capitulo: l.capitulo?.trim() || null,
    }));

  if (propuesta.tipo !== "ampliacion") return out;

  for (const b of propuesta.bajas) {
    if (!b.descripcion.trim() || !(Number(b.importe) > 0)) continue;
    out.push({
      descripcion: b.descripcion.trim(),
      cantidad: 1,
      precio_unitario: -Math.abs(Number(b.importe)),
      unidad: "ud",
      capitulo: CAPITULO_REPERCUSION,
    });
  }
  if (Number(propuesta.ajuste_comercial) !== 0) {
    out.push({
      descripcion: AJUSTE_COMERCIAL_DESC,
      cantidad: 1,
      precio_unitario: Number(propuesta.ajuste_comercial),
      unidad: "ud",
      capitulo: CAPITULO_REPERCUSION,
    });
  }
  return out;
}
