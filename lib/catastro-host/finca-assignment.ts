/**
 * Asignación comercial de una finca. Host CRM, no motor catastral.
 * No crea visitas: Property → Visit.
 */

export type ComercialAsignable = {
  id: string;
  nombre: string;
};

export type AsignacionFinca = {
  fincaReference: string;
  comercialId: string;
  nombre: string;
};

export function nombreComercial(input: {
  nombre_completo?: string | null;
  email?: string | null;
}): string {
  const nombre = input.nombre_completo?.trim();
  if (nombre) return nombre;
  const email = input.email?.trim() ?? "";
  return email.split("@")[0] || "Comercial";
}

export function esRolAsignable(role: string | null | undefined): boolean {
  return role === "comercial" || role === "agente" || role === "admin";
}

export function uuidComercial(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const id = valor.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

export function asignacionDesdeFila(
  fincaReference: string,
  row: { comercial_id?: unknown } | null,
  comerciales: ComercialAsignable[]
): AsignacionFinca | null {
  const comercialId = uuidComercial(row?.comercial_id);
  if (!comercialId) return null;
  const comercial = comerciales.find((item) => item.id === comercialId);
  return {
    fincaReference,
    comercialId,
    nombre: comercial?.nombre ?? "Comercial",
  };
}

export const FILTRO_ASIGNACION_TODAS = "ALL";
export const FILTRO_ASIGNACION_SIN = "UNASSIGNED";
export const FILTRO_ASIGNACION_MIAS = "MINE";

export type RecuentoAsignacionLista = {
  todas: number;
  sinAsignar: number;
  mias: number;
  porComercial: Record<string, number>;
};

export function coincideFiltroAsignacion(
  asignacion: AsignacionFinca | undefined,
  filtro: string,
  yo: string | null
): boolean {
  if (!filtro || filtro === FILTRO_ASIGNACION_TODAS) return true;
  if (filtro === FILTRO_ASIGNACION_SIN) return !asignacion;
  if (filtro === FILTRO_ASIGNACION_MIAS) return Boolean(yo && asignacion?.comercialId === yo);
  return asignacion?.comercialId === filtro;
}

export function filtrarPorAsignacion<T extends { fincaReference: string }>(
  fincas: T[],
  asignaciones: Record<string, AsignacionFinca>,
  filtro: string,
  yo: string | null
): T[] {
  return fincas.filter((finca) =>
    coincideFiltroAsignacion(asignaciones[finca.fincaReference], filtro, yo)
  );
}

export const MAX_ASIGNACION_LOTE = 100;

export function refsDesdeCuerpoAsignacion(cuerpo: {
  fincaReference?: unknown;
  fincaReferences?: unknown;
}): string[] {
  const brutos = Array.isArray(cuerpo.fincaReferences)
    ? cuerpo.fincaReferences
    : cuerpo.fincaReference != null
      ? [cuerpo.fincaReference]
      : [];
  const vistos = new Set<string>();
  const refs: string[] = [];
  for (const item of brutos) {
    if (typeof item !== "string") continue;
    const ref = item.trim();
    if (!ref || vistos.has(ref)) continue;
    vistos.add(ref);
    refs.push(ref);
  }
  return refs;
}

export function recuentoFiltrosAsignacion(
  fincas: Array<{ fincaReference: string }>,
  asignaciones: Record<string, AsignacionFinca>,
  yo: string | null,
  comerciales: ComercialAsignable[]
): RecuentoAsignacionLista {
  const porComercial: Record<string, number> = {};
  for (const comercial of comerciales) porComercial[comercial.id] = 0;
  let sinAsignar = 0;
  let mias = 0;
  for (const finca of fincas) {
    const asignacion = asignaciones[finca.fincaReference];
    if (!asignacion) {
      sinAsignar += 1;
      continue;
    }
    porComercial[asignacion.comercialId] = (porComercial[asignacion.comercialId] ?? 0) + 1;
    if (yo && asignacion.comercialId === yo) mias += 1;
  }
  return { todas: fincas.length, sinAsignar, mias, porComercial };
}
