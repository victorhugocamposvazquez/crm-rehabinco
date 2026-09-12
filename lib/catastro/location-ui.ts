/**
 * Estado de selección oficial para /buscar.
 * No llama a Catastro: solo consume /api/catastro/{provinces,municipalities,streets}.
 */
import {
  criteriosDesdeSearchParams,
  searchParamsDesdeCriterios,
  type CriteriosBusquedaUi,
} from "./search-ui";

export type ProvinciaUi = { code: string; name: string };
export type MunicipioUi = { code: string; name: string };
export type CalleUi = { code: string; sigla: string; name: string };

export type EstadoUbicacion = {
  provincia: ProvinciaUi | null;
  municipio: MunicipioUi | null;
  calle: CalleUi | null;
  provincias: ProvinciaUi[];
  municipios: MunicipioUi[];
  calles: CalleUi[];
  /** Sin datos que mostrar todavía (bloquea el combobox). */
  cargandoProvincias: boolean;
  cargandoMunicipios: boolean;
  cargandoCalles: boolean;
  /** Hay datos de cache en pantalla y se descarga una versión nueva detrás. */
  revalidandoMunicipios: boolean;
  revalidandoCalles: boolean;
  /** Aviso no intrusivo (fallback a datos guardados). */
  avisoCatalogo: string | null;
};

export const ESTADO_UBICACION_VACIO: EstadoUbicacion = {
  provincia: null,
  municipio: null,
  calle: null,
  provincias: [],
  municipios: [],
  calles: [],
  cargandoProvincias: false,
  cargandoMunicipios: false,
  cargandoCalles: false,
  revalidandoMunicipios: false,
  revalidandoCalles: false,
  avisoCatalogo: null,
};

export function esProvinciaUi(item: unknown): item is ProvinciaUi {
  const r = item as Record<string, unknown> | null;
  return Boolean(r && typeof r.code === "string" && typeof r.name === "string");
}

export function esMunicipioUi(item: unknown): item is MunicipioUi {
  return esProvinciaUi(item);
}

export function esCalleUi(item: unknown): item is CalleUi {
  const r = item as Record<string, unknown> | null;
  return Boolean(
    r && typeof r.code === "string" && typeof r.sigla === "string" && typeof r.name === "string"
  );
}

export function municipioDeshabilitado(estado: Pick<EstadoUbicacion, "provincia">): boolean {
  return !estado.provincia;
}

export function calleDeshabilitada(estado: Pick<EstadoUbicacion, "municipio">): boolean {
  return !estado.municipio;
}

export function textoCargaMunicipios(cargando: boolean, provincia?: string | null): string | null {
  if (!cargando) return null;
  return provincia ? `Cargando municipios de ${provincia}...` : "Cargando municipios...";
}

export function textoCargaCalles(cargando: boolean, municipio?: string | null): string | null {
  if (!cargando) return null;
  return municipio ? `Cargando calles de ${municipio}...` : "Cargando calles...";
}

export function textoRevalidacionMunicipios(revalidando: boolean): string | null {
  return revalidando ? "Actualizando municipios..." : null;
}

export function textoRevalidacionCalles(revalidando: boolean): string | null {
  return revalidando ? "Actualizando calles..." : null;
}

/**
 * Aplica una emisión de la cache cliente al estado de municipios.
 * `revalidating` mantiene el combobox usable; solo cambia el texto auxiliar.
 */
export function aplicarEstadoMunicipios(
  estado: EstadoUbicacion,
  emision: { items: MunicipioUi[]; revalidating: boolean; aviso: string | null },
  nombreUrl?: string
): EstadoUbicacion {
  const seleccionSigueValida =
    estado.municipio !== null &&
    emision.items.some((item) => item.code === estado.municipio?.code);

  if (seleccionSigueValida) {
    // Segunda emisión (revalidación): solo refrescar la lista, sin tocar la selección.
    return {
      ...estado,
      municipios: emision.items,
      cargandoMunicipios: false,
      revalidandoMunicipios: emision.revalidating,
      avisoCatalogo: emision.aviso,
    };
  }

  return {
    ...aplicarMunicipiosCargados(estado, emision.items, nombreUrl),
    revalidandoMunicipios: emision.revalidating,
    avisoCatalogo: emision.aviso,
  };
}

export function aplicarEstadoCalles(
  estado: EstadoUbicacion,
  emision: { items: CalleUi[]; revalidating: boolean; aviso: string | null },
  viaUrl?: string,
  siglaUrl?: string
): EstadoUbicacion {
  const seleccionSigueValida =
    estado.calle !== null &&
    emision.items.some(
      (item) => item.code === estado.calle?.code && item.sigla === estado.calle?.sigla
    );

  if (seleccionSigueValida) {
    return {
      ...estado,
      calles: emision.items,
      cargandoCalles: false,
      revalidandoCalles: emision.revalidating,
      avisoCatalogo: emision.aviso,
    };
  }

  return {
    ...aplicarCallesCargadas(estado, emision.items, viaUrl, siglaUrl),
    revalidandoCalles: emision.revalidating,
    avisoCatalogo: emision.aviso,
  };
}

export function etiquetaCalle(calle: CalleUi): string {
  return `${calle.sigla} ${calle.name}`;
}

export function filtrarPorTexto<T>(
  items: T[],
  texto: string,
  etiqueta: (item: T) => string,
  opciones: { minChars?: number; limite?: number; vacioMuestra?: number } = {}
): T[] {
  const minChars = opciones.minChars ?? 0;
  const limite = opciones.limite ?? 40;
  const vacioMuestra = opciones.vacioMuestra ?? 0;
  const q = texto.trim().toUpperCase();
  if (!q) return items.slice(0, vacioMuestra);
  if (q.length < minChars) return [];
  return items.filter((item) => etiqueta(item).toUpperCase().includes(q)).slice(0, limite);
}

export function filtrarCallesLocal(calles: CalleUi[], texto: string): CalleUi[] {
  return filtrarPorTexto(calles, texto, etiquetaCalle, { minChars: 2, limite: 40, vacioMuestra: 0 });
}

export function filtrarMunicipiosLocal(municipios: MunicipioUi[], texto: string): MunicipioUi[] {
  return filtrarPorTexto(municipios, texto, (item) => item.name, {
    minChars: 0,
    limite: 80,
    vacioMuestra: 80,
  });
}

export function aplicarProvinciasCargadas(
  estado: EstadoUbicacion,
  provincias: ProvinciaUi[],
  nombreUrl?: string
): EstadoUbicacion {
  const provincia = nombreUrl ? encontrarPorNombreUi(provincias, nombreUrl) : estado.provincia;
  return {
    ...estado,
    provincias,
    provincia: provincia && provincias.some((item) => item.code === provincia.code) ? provincia : null,
    cargandoProvincias: false,
  };
}

export function aplicarCambioProvincia(
  estado: EstadoUbicacion,
  provincia: ProvinciaUi | null
): EstadoUbicacion {
  return {
    ...estado,
    provincia,
    municipio: null,
    calle: null,
    municipios: [],
    calles: [],
    cargandoMunicipios: Boolean(provincia),
    cargandoCalles: false,
    revalidandoMunicipios: false,
    revalidandoCalles: false,
    avisoCatalogo: null,
  };
}

export function aplicarMunicipiosCargados(
  estado: EstadoUbicacion,
  municipios: MunicipioUi[],
  nombreUrl?: string
): EstadoUbicacion {
  const municipio = nombreUrl ? encontrarPorNombreUi(municipios, nombreUrl) : null;
  return {
    ...estado,
    municipios,
    municipio,
    calle: null,
    calles: [],
    cargandoMunicipios: false,
    cargandoCalles: Boolean(municipio),
  };
}

export function aplicarCambioMunicipio(
  estado: EstadoUbicacion,
  municipio: MunicipioUi | null
): EstadoUbicacion {
  return {
    ...estado,
    municipio,
    calle: null,
    calles: [],
    cargandoCalles: Boolean(municipio),
    revalidandoCalles: false,
  };
}

export function aplicarCallesCargadas(
  estado: EstadoUbicacion,
  calles: CalleUi[],
  viaUrl?: string,
  siglaUrl?: string
): EstadoUbicacion {
  return {
    ...estado,
    calles,
    calle: seleccionarCallePorUrl(calles, viaUrl ?? "", siglaUrl ?? ""),
    cargandoCalles: false,
  };
}

export function aplicarCambioCalle(estado: EstadoUbicacion, calle: CalleUi | null): EstadoUbicacion {
  return { ...estado, calle };
}

export function encontrarPorNombreUi<T extends { name: string }>(
  items: T[],
  nombre: string
): T | null {
  const objetivo = nombre.trim().toUpperCase();
  if (!objetivo) return null;
  return items.find((item) => item.name.trim().toUpperCase() === objetivo) ?? null;
}

export function seleccionarCallePorUrl(
  calles: CalleUi[],
  via: string,
  sigla: string
): CalleUi | null {
  const nombre = via.trim().toUpperCase();
  const tipo = sigla.trim().toUpperCase();
  if (!nombre) return null;
  if (tipo) {
    return (
      calles.find((item) => item.name.toUpperCase() === nombre && item.sigla.toUpperCase() === tipo) ??
      null
    );
  }
  const homonimas = calles.filter((item) => item.name.toUpperCase() === nombre);
  return homonimas.length === 1 ? homonimas[0] : null;
}

export function criteriosDesdeUbicacion(
  estado: EstadoUbicacion,
  extras: Pick<CriteriosBusquedaUi, "numero" | "postalCode" | "horizontalDivision">
): CriteriosBusquedaUi | null {
  if (!estado.provincia || !estado.municipio || !estado.calle) return null;
  return {
    provincia: estado.provincia.name,
    municipio: estado.municipio.name,
    sigla: estado.calle.sigla,
    via: estado.calle.name,
    numero: extras.numero,
    postalCode: extras.postalCode,
    horizontalDivision: extras.horizontalDivision,
  };
}

export function urlDesdeUbicacion(
  estado: EstadoUbicacion,
  extras: Pick<CriteriosBusquedaUi, "numero" | "postalCode" | "horizontalDivision">
): URLSearchParams {
  const criterios = criteriosDesdeUbicacion(estado, extras);
  if (!criterios) {
    const params = new URLSearchParams();
    if (estado.provincia) params.set("provincia", estado.provincia.name);
    if (estado.municipio) params.set("municipio", estado.municipio.name);
    return params;
  }
  return searchParamsDesdeCriterios(criterios);
}

export function criteriosUrlIniciales(params: URLSearchParams): CriteriosBusquedaUi {
  return criteriosDesdeSearchParams(params);
}

export function clavePeticionCatalogo(
  recurso: "municipalities" | "streets",
  provincia?: string,
  municipio?: string
): string {
  return [recurso, provincia?.trim().toUpperCase() ?? "", municipio?.trim().toUpperCase() ?? ""].join(
    "|"
  );
}

export function esRespuestaObsoleta(claveEsperada: string, claveActual: string | null): boolean {
  return claveActual !== claveEsperada;
}

export async function fetchProvinciasCatalogo(signal: AbortSignal): Promise<ProvinciaUi[]> {
  const respuesta = await fetch("/api/catastro/provinces", { credentials: "same-origin", signal });
  if (!respuesta.ok) throw new Error("No se han podido cargar las provincias.");
  const cuerpo = (await respuesta.json()) as { ok?: boolean; provinces?: ProvinciaUi[] };
  if (!cuerpo.ok || !Array.isArray(cuerpo.provinces)) {
    throw new Error("No se han podido cargar las provincias.");
  }
  return cuerpo.provinces;
}

export async function fetchMunicipiosCatalogo(
  provincia: string,
  signal: AbortSignal
): Promise<MunicipioUi[]> {
  const params = new URLSearchParams({ province: provincia });
  const respuesta = await fetch(`/api/catastro/municipalities?${params}`, {
    credentials: "same-origin",
    signal,
  });
  if (!respuesta.ok) throw new Error("No se han podido cargar los municipios.");
  const cuerpo = (await respuesta.json()) as { ok?: boolean; items?: MunicipioUi[] };
  if (!cuerpo.ok || !Array.isArray(cuerpo.items)) {
    throw new Error("No se han podido cargar los municipios.");
  }
  return cuerpo.items;
}

export async function fetchCallesCatalogo(
  provincia: string,
  municipio: string,
  signal: AbortSignal
): Promise<CalleUi[]> {
  const params = new URLSearchParams({ province: provincia, municipality: municipio });
  const respuesta = await fetch(`/api/catastro/streets?${params}`, {
    credentials: "same-origin",
    signal,
  });
  if (!respuesta.ok) throw new Error("No se han podido cargar las calles.");
  const cuerpo = (await respuesta.json()) as { ok?: boolean; items?: CalleUi[] };
  if (!cuerpo.ok || !Array.isArray(cuerpo.items)) {
    throw new Error("No se han podido cargar las calles.");
  }
  return cuerpo.items;
}
