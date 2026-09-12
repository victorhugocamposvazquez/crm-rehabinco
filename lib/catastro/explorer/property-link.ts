/**
 * Orquestación de vínculo Property. Habla con el puerto, no con el CRM.
 */
import { direccionOficial } from "../selection-export";
import { tituloDireccionFinca, type FincaBusquedaUi } from "../search-ui";
import type { ExplorerStore } from "./ports";
import {
  ORIGEN_CATASTRO_EXPLORER,
  type CatastroPropertyIntegration,
  type CatastroPropertyLink,
  type DatosPropiedadDesdeCatastro,
  type ResultadoActualizacionCatastro,
  type ResultadoVinculoPropiedad,
} from "./property-port";
import type { CatastroFinca } from "./types";

export const TEXTO_BADGE_CATASTRO = "CATÁSTRO EXPLORER";
export const TEXTO_BADGE_VINCULADA = "VINCULADA A PROPERTY";
export const TEXTO_FUENTE_CATASTRO = "CATÁSTRO EXPLORER";

export const FILTROS_VINCULO_PROPERTY = [
  { value: "ALL", label: "Todas" },
  { value: "LINKED", label: "Vinculadas a Property" },
  { value: "UNLINKED", label: "No vinculadas" },
] as const;

export type FiltroVinculoProperty = (typeof FILTROS_VINCULO_PROPERTY)[number]["value"];

export const FILTROS_ORIGEN_CATASTRAL = [
  { value: "ALL", label: "Todos" },
  { value: "CATASTRO_EXPLORER", label: "Catastro Explorer" },
  { value: "UNLINKED", label: "Sin vinculación catastral" },
] as const;

export type FiltroOrigenCatastral = (typeof FILTROS_ORIGEN_CATASTRAL)[number]["value"];

export const FILTROS_DH_PROPERTY = [
  { value: "ALL", label: "Todos" },
  { value: "NO", label: "Sin división horizontal" },
  { value: "YES", label: "Con división horizontal" },
  { value: "UNKNOWN", label: "No determinado" },
  { value: "NOT_APPLICABLE", label: "No aplica" },
] as const;

export type FiltroDhProperty = (typeof FILTROS_DH_PROPERTY)[number]["value"];

export const ERRORES_VINCULO_HTTP = {
  FORBIDDEN: { status: 403, error: "No tienes permiso para crear propiedades." },
  NOT_FOUND: { status: 404, error: "Finca no encontrada." },
  PROPERTY_FAILED: { status: 500, error: "No se ha podido crear la propiedad." },
  LINK_FAILED: { status: 500, error: "No se ha podido vincular la finca." },
  FAILED: { status: 500, error: "No se ha podido crear la propiedad." },
  OFERTANTE_REQUIRED: { status: 400, error: "Selecciona un propietario (ofertante)" },
} as const;

/** Misma regla que el alta manual: el ofertante es un cliente elegido, nunca inventado. */
export function ofertanteParaAltaCatastro(ofertanteId: string | null | undefined): string | null {
  const id = ofertanteId?.trim() ?? "";
  return id ? id : null;
}

export const CATASTRO_STALE_MS = 30 * 24 * 60 * 60 * 1000;

export function frescuraInformacionCatastral(
  lastSeenAt: string | null | undefined,
  now: string
): { lastSeenAt: string | null; reciente: boolean; etiqueta: "Reciente" | "No reciente" | "Sin fecha" } {
  if (!lastSeenAt) return { lastSeenAt: null, reciente: false, etiqueta: "Sin fecha" };
  const visto = new Date(lastSeenAt).getTime();
  const actual = new Date(now).getTime();
  if (Number.isNaN(visto) || Number.isNaN(actual)) {
    return { lastSeenAt, reciente: false, etiqueta: "Sin fecha" };
  }
  const reciente = actual - visto <= CATASTRO_STALE_MS;
  return { lastSeenAt, reciente, etiqueta: reciente ? "Reciente" : "No reciente" };
}

export function fechasCatastroYProperty(input: {
  lastSeenAt?: string | null;
  propertyCreatedAt?: string | null;
}): {
  ultimaInformacionCatastro: string | null;
  fechaCreacionProperty: string | null;
} {
  return {
    ultimaInformacionCatastro: input.lastSeenAt ?? null,
    fechaCreacionProperty: input.propertyCreatedAt ?? null,
  };
}

/**
 * Punto de extensión. Localiza la CatastroFinca persistida y reporta lastSeenAt.
 * No consulta Catastro. No sincroniza la Property.
 */
export async function actualizarDatosDesdeCatastro(
  store: ExplorerStore,
  fincaReference: string,
  now: string
): Promise<ResultadoActualizacionCatastro> {
  const finca = await store.getFinca(fincaReference);
  if (!finca) return { ok: false, error: "NOT_FOUND" };
  const frescura = frescuraInformacionCatastral(finca.lastSeenAt, now);
  return {
    ok: true,
    executed: false,
    reason: "NOT_IMPLEMENTED",
    fincaReference: finca.fincaReference,
    lastSeenAt: finca.lastSeenAt ?? null,
    reciente: frescura.reciente,
  };
}

export function rutaPropiedadCrm(propertyId: string): string {
  return `/propiedades/${propertyId}`;
}

export function esOrigenCatastroExplorer(origen: string | null | undefined): boolean {
  return origen === ORIGEN_CATASTRO_EXPLORER;
}

export function coincideOrigenCatastral(
  origen: string | null | undefined,
  filtro: FiltroOrigenCatastral
): boolean {
  if (filtro === "ALL") return true;
  if (filtro === "CATASTRO_EXPLORER") return esOrigenCatastroExplorer(origen);
  return !esOrigenCatastroExplorer(origen);
}

/** Usa el status persistido de CatastroFinca. Nunca convierte UNKNOWN en NO. */
export function coincideDhCatastro(
  dhStatus: string | null | undefined,
  filtro: FiltroDhProperty
): boolean {
  if (filtro === "ALL") return true;
  if (dhStatus == null) return false;
  return dhStatus === filtro;
}

export function fincaReferenceDesdeVinculo(input: {
  propertyId?: string | null;
  origen?: string | null;
  referenciaCatastral?: string | null;
  link?: Pick<CatastroPropertyLink, "fincaReference"> | null;
}): string | null {
  const delLink = input.link?.fincaReference?.trim().toUpperCase() ?? "";
  if (delLink.length === 14) return delLink;
  const rc = input.referenciaCatastral?.trim().toUpperCase() ?? "";
  if (esOrigenCatastroExplorer(input.origen) && rc.length === 14) return rc;
  return null;
}

export function datosPropiedadDesdeFinca(finca: CatastroFinca | FincaBusquedaUi): DatosPropiedadDesdeCatastro {
  const ui = finca as FincaBusquedaUi;
  return {
    fincaReference: ui.fincaReference,
    titulo: tituloDireccionFinca(ui),
    direccion: direccionOficial(ui),
    codigoPostal: ui.postalCode ?? ui.postalCodes?.[0] ?? "",
    localidad: ui.address.municipio?.trim() ?? "",
    superficieSolar: ui.superficieSolar ?? null,
    horizontalDivision: {
      status: ui.horizontalDivision?.status ?? "UNKNOWN",
      ...(ui.horizontalDivision?.reasonCode ? { reasonCode: ui.horizontalDivision.reasonCode } : {}),
    },
  };
}

/** DH no decide el estado CRM. UNKNOWN/NOT_APPLICABLE/NO/YES pueden crear Property. */
export function puedeCrearPropiedadDesdeClasificacion(status: string | undefined): boolean {
  return status === "NO" || status === "YES" || status === "UNKNOWN" || status === "NOT_APPLICABLE";
}

export function etiquetasVinculoPropiedad(links: CatastroPropertyLink[]): {
  estado: "No vinculada" | "Vinculada" | "Varias propiedades";
  accion: "Crear propiedad" | "Ver propiedad" | "Ver propiedades";
  badge: "VINCULADA A PROPERTY" | null;
} {
  if (links.length === 0) {
    return { estado: "No vinculada", accion: "Crear propiedad", badge: null };
  }
  if (links.length === 1) {
    return { estado: "Vinculada", accion: "Ver propiedad", badge: "VINCULADA A PROPERTY" };
  }
  return { estado: "Varias propiedades", accion: "Ver propiedades", badge: "VINCULADA A PROPERTY" };
}

export function filtrarPorVinculoPropiedad<T extends { fincaReference: string }>(
  fincas: T[],
  links: CatastroPropertyLink[],
  filtro: "ALL" | "LINKED" | "UNLINKED"
): T[] {
  if (filtro === "ALL") return fincas;
  const vinculadas = new Set(links.map((item) => item.fincaReference));
  if (filtro === "LINKED") return fincas.filter((finca) => vinculadas.has(finca.fincaReference));
  return fincas.filter((finca) => !vinculadas.has(finca.fincaReference));
}

export async function crearOReutilizarPropiedad(
  store: ExplorerStore,
  integration: CatastroPropertyIntegration,
  input: {
    fincaReference: string;
    userId: string;
    now: string;
    puedeCrear: boolean;
    ofertanteId?: string | null;
  }
): Promise<ResultadoVinculoPropiedad> {
  if (!input.puedeCrear) return { ok: false, error: "FORBIDDEN" };
  const finca = await store.getFinca(input.fincaReference);
  if (!finca) return { ok: false, error: "NOT_FOUND" };
  if (!puedeCrearPropiedadDesdeClasificacion(finca.horizontalDivision.status)) {
    return { ok: false, error: "FAILED" };
  }
  const existentes = await integration.findLinksByFincaReference(input.fincaReference);
  if (existentes[0]) {
    return { ok: true, created: false, link: existentes[0] };
  }
  const ofertanteId = ofertanteParaAltaCatastro(input.ofertanteId);
  if (!ofertanteId) return { ok: false, error: "OFERTANTE_REQUIRED" };
  return integration.createPropertyFromCatastro({
    finca,
    datos: datosPropiedadDesdeFinca(finca),
    userId: input.userId,
    now: input.now,
    ofertanteId,
  });
}

export { ORIGEN_CATASTRO_EXPLORER };
