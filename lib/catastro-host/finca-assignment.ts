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
