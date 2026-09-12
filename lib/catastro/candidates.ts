import {
  fusionarDireccionFinca,
  fusionarPropiedad,
  type FincaDescubierta,
} from "./finca";
import type { EstadoDhFinca } from "./applicability";
import type { UnknownReason } from "./unknown-reason";

export type FiltroDivisionHorizontal = "ALL" | "YES" | "NO" | "UNKNOWN" | "NOT_APPLICABLE";

export type ClasificacionCandidatos = {
  all: FincaDescubierta[];
  withoutHorizontalDivision: FincaDescubierta[];
  withHorizontalDivision: FincaDescubierta[];
  unknown: FincaDescubierta[];
  notApplicable: FincaDescubierta[];
  completeCandidates: boolean;
};

export type ContextoCandidatos = {
  complete: boolean;
  hasNextPage: boolean;
  possibleCut: boolean;
  portalErrors: number;
};

function porReferencia(a: FincaDescubierta, b: FincaDescubierta): number {
  return a.fincaReference.localeCompare(b.fincaReference);
}

function unicosOrdenados(valores: string[]): string[] {
  return [...new Set(valores)].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, "es"));
}

export function fusionarFincas(
  previa: FincaDescubierta | undefined,
  actual: FincaDescubierta
): FincaDescubierta {
  if (!previa || previa.fincaReference !== actual.fincaReference) return actual;
  const propertiesPorRef = new Map(
    previa.properties.map((item) => [item.reference, item] as const)
  );
  for (const propiedad of actual.properties) {
    const existente = propertiesPorRef.get(propiedad.reference);
    propertiesPorRef.set(
      propiedad.reference,
      existente ? fusionarPropiedad(existente, propiedad) : propiedad
    );
  }
  const postalCodes = unicosOrdenados([...previa.postalCodes, ...actual.postalCodes]);
  return {
    ...actual,
    propertyReferences: [...new Set([...previa.propertyReferences, ...actual.propertyReferences])].sort(),
    properties: [...propertiesPorRef.values()].sort((a, b) => a.reference.localeCompare(b.reference)),
    portals: unicosOrdenados([...previa.portals, ...actual.portals]),
    address: fusionarDireccionFinca(previa.address, actual.address),
    ltp: actual.ltp ?? previa.ltp,
    postalCode: postalCodes[0] ?? actual.postalCode ?? previa.postalCode,
    postalCodes,
    superficieSolar: actual.superficieSolar ?? previa.superficieSolar,
    horizontalDivision: preferirDivision(previa.horizontalDivision, actual.horizontalDivision),
  };
}

function rangoEstado(status: EstadoDhFinca): number {
  if (status === "YES" || status === "NO") return 2;
  if (status === "UNKNOWN") return 1;
  return 0;
}

function rangoReasonCode(codigo: UnknownReason | undefined): number {
  if (codigo === "MIXED_URBAN_RURAL") return 4;
  if (codigo === "LTP_UNRECOGNIZED") return 3;
  if (codigo === "LTP_MISSING") return 2;
  if (codigo === "QUERY_ERROR") return 1;
  if (codigo === "OTHER") return 0;
  return -1;
}

function preferirDivision(
  previa: FincaDescubierta["horizontalDivision"],
  actual: FincaDescubierta["horizontalDivision"]
): FincaDescubierta["horizontalDivision"] {
  if (rangoEstado(actual.status) > rangoEstado(previa.status)) return actual;
  if (rangoEstado(previa.status) > rangoEstado(actual.status)) return previa;
  if (actual.status !== "UNKNOWN") return actual;
  return rangoReasonCode(previa.reasonCode) >= rangoReasonCode(actual.reasonCode)
    ? previa
    : actual;
}

/**
 * Completitud de candidatos: solo cuentan UNKNOWN aplicables, páginas
 * pendientes, possibleCut y errores de portal. NOT_APPLICABLE no es pendiente:
 * la pregunta de DH no le aplica.
 */
export function evaluarExhaustividadCandidatos(
  contexto: ContextoCandidatos,
  unknownCount: number
): boolean {
  return (
    contexto.complete &&
    !contexto.hasNextPage &&
    !contexto.possibleCut &&
    contexto.portalErrors === 0 &&
    unknownCount === 0
  );
}

export function clasificarCandidatos(
  fincas: FincaDescubierta[],
  contexto: ContextoCandidatos
): ClasificacionCandidatos {
  const withoutHorizontalDivision: FincaDescubierta[] = [];
  const withHorizontalDivision: FincaDescubierta[] = [];
  const unknown: FincaDescubierta[] = [];
  const notApplicable: FincaDescubierta[] = [];

  for (const finca of fincas) {
    if (finca.horizontalDivision.status === "NO") {
      withoutHorizontalDivision.push(finca);
    } else if (finca.horizontalDivision.status === "YES") {
      withHorizontalDivision.push(finca);
    } else if (finca.horizontalDivision.status === "NOT_APPLICABLE") {
      notApplicable.push(finca);
    } else {
      unknown.push(finca);
    }
  }

  return {
    all: [...fincas].sort(porReferencia),
    withoutHorizontalDivision: withoutHorizontalDivision.sort(porReferencia),
    withHorizontalDivision: withHorizontalDivision.sort(porReferencia),
    unknown: unknown.sort(porReferencia),
    notApplicable: notApplicable.sort(porReferencia),
    completeCandidates: evaluarExhaustividadCandidatos(contexto, unknown.length),
  };
}

export function getNonHorizontalDivisionFincas(
  fincas: FincaDescubierta[],
  contexto: ContextoCandidatos
): FincaDescubierta[] {
  return clasificarCandidatos(fincas, contexto).withoutHorizontalDivision;
}

export function filtrarPorDivision(
  fincas: FincaDescubierta[],
  filtro: FiltroDivisionHorizontal
): FincaDescubierta[] {
  if (filtro === "ALL") return fincas;
  return fincas.filter((finca) => finca.horizontalDivision.status === filtro);
}

export function parsearFiltroDivision(
  raw: string
): { ok: true; value: FiltroDivisionHorizontal } | { ok: false; error: string } {
  const normalizado = raw.trim().toUpperCase();
  if (!normalizado) return { ok: true, value: "ALL" };
  if (
    normalizado === "ALL" ||
    normalizado === "YES" ||
    normalizado === "NO" ||
    normalizado === "UNKNOWN" ||
    normalizado === "NOT_APPLICABLE"
  ) {
    return { ok: true, value: normalizado };
  }
  return {
    ok: false,
    error: "horizontalDivision debe ser ALL, NO, YES, UNKNOWN o NOT_APPLICABLE.",
  };
}

export function contextoDesdeDiscovery(input: {
  complete: boolean;
  hasNextPage: boolean;
  possibleCut: boolean;
  portals: Array<{ error: { codigo: string; descripcion: string } | null }>;
}): ContextoCandidatos {
  return {
    complete: input.complete,
    hasNextPage: input.hasNextPage,
    possibleCut: input.possibleCut,
    portalErrors: input.portals.filter((portal) => portal.error).length,
  };
}

export type { EstadoDhFinca } from "./applicability";
export type { EstadoDivisionHorizontal } from "./horizontal-division";
