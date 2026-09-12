/**
 * Estado comercial local para gestionar UNKNOWN sin convertirlos en candidatos.
 * No modifica horizontalDivision, la API ni Catastro.
 */
import type { FincaBusquedaUi } from "./search-ui";

export type EstadoRevision = "NONE" | "REVIEW";

export type FiltroRevisionComercial = "ALL" | "CANDIDATES" | "REVIEW";

export type RevisionFincas = {
  /** Búsqueda a la que pertenecen las revisiones (`claveCriterios` / `claveZonaUi`). */
  claveBusqueda: string | null;
  /** Orden de marcado; identidad por `fincaReference`. */
  fincas: FincaBusquedaUi[];
};

export const REVISION_VACIA: RevisionFincas = { claveBusqueda: null, fincas: [] };

export const FILTROS_REVISION_COMERCIAL = [
  { value: "ALL", label: "Todos" },
  { value: "CANDIDATES", label: "Candidatos confirmados" },
  { value: "REVIEW", label: "Para revisar" },
] as const;

export function puedeMarcarseRevision(finca: Pick<FincaBusquedaUi, "horizontalDivision">): boolean {
  return finca.horizontalDivision?.status === "UNKNOWN";
}

export function estaEnRevision(revision: RevisionFincas, fincaReference: string): boolean {
  return revision.fincas.some((finca) => finca.fincaReference === fincaReference);
}

export function estadoRevisionDe(revision: RevisionFincas, fincaReference: string): EstadoRevision {
  return estaEnRevision(revision, fincaReference) ? "REVIEW" : "NONE";
}

/** Si la revisión era de otra búsqueda, se descarta: no se mezclan búsquedas. */
export function revisionParaBusqueda(revision: RevisionFincas, claveBusqueda: string): RevisionFincas {
  if (revision.claveBusqueda === claveBusqueda) return revision;
  return { claveBusqueda, fincas: [] };
}

export function limpiarRevision(): RevisionFincas {
  return REVISION_VACIA;
}

/**
 * Marca o quita REVIEW. Solo UNKNOWN puede entrar.
 * No muta `horizontalDivision`.
 */
export function alternarRevision(
  revision: RevisionFincas,
  finca: FincaBusquedaUi,
  claveBusqueda: string
): RevisionFincas {
  const base = revisionParaBusqueda(revision, claveBusqueda);
  if (estaEnRevision(base, finca.fincaReference)) {
    return {
      claveBusqueda,
      fincas: base.fincas.filter((item) => item.fincaReference !== finca.fincaReference),
    };
  }
  if (!puedeMarcarseRevision(finca)) return base;
  return { claveBusqueda, fincas: [...base.fincas, finca] };
}

export function marcarRevision(
  revision: RevisionFincas,
  finca: FincaBusquedaUi,
  claveBusqueda: string
): RevisionFincas {
  const base = revisionParaBusqueda(revision, claveBusqueda);
  if (!puedeMarcarseRevision(finca) || estaEnRevision(base, finca.fincaReference)) return base;
  return { claveBusqueda, fincas: [...base.fincas, finca] };
}

export function quitarRevision(
  revision: RevisionFincas,
  fincaReference: string,
  claveBusqueda: string
): RevisionFincas {
  const base = revisionParaBusqueda(revision, claveBusqueda);
  return {
    claveBusqueda,
    fincas: base.fincas.filter((item) => item.fincaReference !== fincaReference),
  };
}

export function filtrarPorRevisionComercial(
  fincas: FincaBusquedaUi[],
  filtro: FiltroRevisionComercial,
  revision: RevisionFincas
): FincaBusquedaUi[] {
  if (filtro === "CANDIDATES") {
    return fincas.filter((finca) => finca.horizontalDivision?.status === "NO");
  }
  if (filtro === "REVIEW") {
    return fincas.filter((finca) => estaEnRevision(revision, finca.fincaReference));
  }
  return fincas;
}

export function etiquetaEstadoComercial(
  finca: Pick<FincaBusquedaUi, "fincaReference" | "horizontalDivision">,
  revision: RevisionFincas = REVISION_VACIA
): string {
  if (estaEnRevision(revision, finca.fincaReference)) return "Para revisar";
  if (finca.horizontalDivision?.status === "NO") return "Candidato confirmado";
  return "Sin marcar";
}

/** Subtítulo comercial bajo NO DETERMINADO. Nunca «Candidato» ni «SIN DIVISIÓN HORIZONTAL». */
export function textoRevisionUi(enRevision: boolean, status?: string): string | null {
  if (status !== "UNKNOWN" || !enRevision) return null;
  return "Para revisar";
}

export function textoRevision(total: number): string {
  return total === 1 ? "1 para revisar" : `${total} para revisar`;
}

export function textoBarraSeleccionYRevision(seleccionadas: number, enRevision: number): string {
  const partes: string[] = [];
  if (seleccionadas > 0) {
    partes.push(seleccionadas === 1 ? "1 finca seleccionada" : `${seleccionadas} fincas seleccionadas`);
  }
  if (enRevision > 0) partes.push(textoRevision(enRevision));
  return partes.join(" · ");
}
