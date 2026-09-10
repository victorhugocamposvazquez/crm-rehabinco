import type { CopilotoOutput, LineaCopiloto } from "@/lib/ai/presupuesto-copiloto";

export type DiffPresupuesto = {
  partidasAntes: number;
  partidasDespues: number;
  partidasNuevas: number;
  partidasQuitadas: number;
  baseAntes: number;
  baseDespues: number;
  descuentoAntes: number;
  descuentoDespues: number;
  conceptoCambia: boolean;
};

function clave(l: LineaCopiloto) {
  return `${l.capitulo.trim()}|${l.descripcion.trim()}|${l.unidad}|${l.cantidad}|${l.precioUnitario}`;
}

export function importeLineas(lineas: LineaCopiloto[]) {
  return lineas.reduce((acc, l) => acc + Number(l.cantidad) * Number(l.precioUnitario), 0);
}

export function diffPresupuesto(params: {
  conceptoActual: string;
  descuentoActual: number;
  lineasActuales: LineaCopiloto[];
  propuesta: CopilotoOutput;
}): DiffPresupuesto {
  const antes = params.lineasActuales.filter((l) => l.descripcion.trim());
  const despues = params.propuesta.lineas.filter((l) => l.descripcion.trim());
  const setAntes = new Set(antes.map(clave));
  const setDespues = new Set(despues.map(clave));
  return {
    partidasAntes: antes.length,
    partidasDespues: despues.length,
    partidasNuevas: despues.filter((l) => !setAntes.has(clave(l))).length,
    partidasQuitadas: antes.filter((l) => !setDespues.has(clave(l))).length,
    baseAntes: importeLineas(antes),
    baseDespues: importeLineas(despues),
    descuentoAntes: params.descuentoActual,
    descuentoDespues: params.propuesta.porcentaje_descuento,
    conceptoCambia: params.conceptoActual.trim() !== params.propuesta.concepto.trim(),
  };
}

export function euro(n: number) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}
