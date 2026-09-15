import { type TipoOperacionDemanda } from "./matching";

export const ORIGENES_DEMANDA = [
  { id: "llamada", label: "Llamada" },
  { id: "oficina", label: "Oficina" },
  { id: "web", label: "Web" },
  { id: "portal", label: "Portal" },
  { id: "referido", label: "Referido" },
] as const;

export const REQUISITOS_RAPIDOS = ["Ascensor", "Exterior", "Garaje", "Terraza", "Para reformar"] as const;

export type BorradorNuevaDemanda = {
  clienteId: string;
  comercialId: string;
  tipoOperacion: TipoOperacionDemanda;
  tiposInmueble: string[];
  zonas: string[];
  presupuestoMin: string;
  presupuestoMax: string;
  superficieMin: string;
  superficieMax: string;
  habitacionesMin: string;
  banosMin: string;
  requisitos: string;
  requisitosRapidos: string[];
  origen: string;
};

export function numeroOpcional(valor: string): number | null {
  const t = valor.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function enteroOpcional(valor: string): number | null {
  const n = numeroOpcional(valor);
  return n == null ? null : Math.round(n);
}

export function combinarRequisitos(texto: string, chips: string[]): string | null {
  const extras = [...new Set(chips.map((item) => item.trim()).filter(Boolean))];
  const cuerpo = texto.trim();
  const partes = [...extras];
  if (cuerpo) partes.push(cuerpo);
  return partes.length ? partes.join(". ") : null;
}

export function validarNuevaDemanda(borrador: BorradorNuevaDemanda): string | null {
  if (!borrador.clienteId) return "Elige o crea un cliente.";
  if (!borrador.comercialId) return "Asigna un comercial.";
  const pmin = numeroOpcional(borrador.presupuestoMin);
  const pmax = numeroOpcional(borrador.presupuestoMax);
  if (pmin != null && pmax != null && pmin > pmax) {
    return "El presupuesto mínimo no puede ser mayor que el máximo.";
  }
  const smin = numeroOpcional(borrador.superficieMin);
  const smax = numeroOpcional(borrador.superficieMax);
  if (smin != null && smax != null && smin > smax) {
    return "Los m² mínimos no pueden ser mayores que los máximos.";
  }
  return null;
}

export function payloadNuevaDemanda(borrador: BorradorNuevaDemanda) {
  return {
    cliente_id: borrador.clienteId,
    comercial_id: borrador.comercialId,
    tipo_operacion: borrador.tipoOperacion,
    tipos_inmueble: borrador.tiposInmueble,
    zonas: borrador.zonas,
    presupuesto_min: numeroOpcional(borrador.presupuestoMin),
    presupuesto_max: numeroOpcional(borrador.presupuestoMax),
    superficie_min: numeroOpcional(borrador.superficieMin),
    superficie_max: numeroOpcional(borrador.superficieMax),
    habitaciones_min: enteroOpcional(borrador.habitacionesMin),
    banos_min: enteroOpcional(borrador.banosMin),
    requisitos: combinarRequisitos(borrador.requisitos, borrador.requisitosRapidos),
    origen: borrador.origen || null,
    estado: "activa" as const,
  };
}
