/**
 * Capa de producto: búsqueda comercial de fincas.
 * HTTP → commercial-search → candidates → discovery → Catastro
 */
import { getCatastroClient, type CatastroClient } from "./client";
import {
  clasificarCandidatos,
  filtrarPorDivision,
  fusionarFincas,
  parsearFiltroDivision,
  type ClasificacionCandidatos,
  type FiltroDivisionHorizontal,
} from "./candidates";
import {
  API_DEFAULT_CONCURRENCY,
  API_DEFAULT_MAX_PORTALS,
  API_MAX_CONCURRENCY,
  API_MAX_PORTALS,
  TIPOS_VIA_OFICIALES,
} from "./constants";
import { discoverFincas, DiscoverySessionError } from "./discovery";
import type { DiscoveryResult } from "./discovery";
import { getDiscoveryStore, type DiscoverySessionStore } from "./discovery-session";
import type { FincaDescubierta as Finca, PrefiltroCodigoPostal } from "./finca";
import { CatastroHttpError } from "./http";
import { getFincaReference } from "./references";
import type { ErrorCatastro } from "./types";
import { recuentoReasonCodeUnknown } from "./unknown-reason";

export type { Finca, FiltroDivisionHorizontal };

export type CriteriosBusquedaComercial = {
  provincia?: string;
  municipio?: string;
  sigla?: string;
  via?: string;
  numero?: string;
  postalCode?: string;
  horizontalDivision?: FiltroDivisionHorizontal | string;
  pageSize?: number;
  cursor?: string;
};

export type CriteriosNormalizados = {
  provincia: string;
  municipio: string;
  sigla: string;
  via: string;
  numero?: string;
  postalCode?: string;
  horizontalDivision: FiltroDivisionHorizontal;
  pageSize: number;
  cursor?: string;
};

export type PaginacionComercial = {
  hasNextPage: boolean;
  nextCursor?: string;
};

export type CoberturaComercial = {
  complete: boolean;
  completeCandidates: boolean;
  possibleCut: boolean;
  portalsFound: number;
  portalsProcessed: number;
};

export type ResultadoBusquedaComercial = {
  ok: true;
  search: {
    provincia: string;
    municipio: string;
    sigla: string;
    via: string;
    numero?: string;
    postalCode?: string;
    horizontalDivision: FiltroDivisionHorizontal;
  };
  results: Finca[];
  pagination: PaginacionComercial;
  coverage: CoberturaComercial;
};

export type ErrorBusquedaComercial = {
  ok: false;
  code: "invalid" | "not_found" | "upstream" | "expired";
  error: string | ErrorCatastro;
  search?: ResultadoBusquedaComercial["search"];
};

export type OpcionesBusquedaComercial = {
  client?: CatastroClient;
  store?: DiscoverySessionStore;
  concurrency?: number;
};

export type EjecucionBusquedaComercial = {
  ok: true;
  resultado: ResultadoBusquedaComercial;
  discovery: DiscoveryResult;
  candidatos: ClasificacionCandidatos;
};

const CAMPOS_OBLIGATORIOS = ["provincia", "municipio", "sigla", "via"] as const;
const CODIGOS_NO_ENCONTRADO = new Set(["10", "33"]);

function normalizarTexto(valor: string): string {
  return valor.trim().replace(/\s+/g, " ").toUpperCase();
}

function acotar(valor: number | undefined, defecto: number, maximo: number): number {
  if (valor == null || !Number.isFinite(valor)) return defecto;
  return Math.min(Math.max(0, Math.floor(valor)), maximo);
}

export function compararNumeroOficial(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, "es");
}

function primerPortalOficial(finca: Finca): string {
  const numeros = [
    ...finca.portals,
    finca.address.numero,
    finca.address.numero && finca.address.numero2
      ? `${finca.address.numero}${finca.address.numero2}`
      : finca.address.numero2,
  ].filter((item): item is string => Boolean(item));
  return [...numeros].sort(compararNumeroOficial)[0] ?? finca.fincaReference;
}

export function ordenarFincasComerciales(fincas: Finca[]): Finca[] {
  return [...fincas].sort((a, b) => {
    const porPortal = compararNumeroOficial(primerPortalOficial(a), primerPortalOficial(b));
    if (porPortal !== 0) return porPortal;
    return a.fincaReference.localeCompare(b.fincaReference);
  });
}

export function deduplicarFincas(fincas: Finca[]): Finca[] {
  const porId = new Map<string, Finca>();
  for (const finca of fincas) {
    const id =
      getFincaReference(finca.fincaReference) ??
      getFincaReference(finca.propertyReferences[0]);
    if (!id) continue;
    porId.set(id, fusionarFincas(porId.get(id), { ...finca, fincaReference: id }));
  }
  return [...porId.values()];
}

export function normalizarCriterios(
  input: CriteriosBusquedaComercial
): { ok: true; criterios: CriteriosNormalizados } | { ok: false; error: string } {
  const cursor = input.cursor?.trim() || undefined;
  const provincia = input.provincia?.trim() ?? "";
  const municipio = input.municipio?.trim() ?? "";
  const siglaRaw = input.sigla?.trim() ?? "";
  const via = input.via?.trim() ?? "";
  const continuacion = Boolean(cursor);
  const presentes = { provincia, municipio, sigla: siglaRaw, via };
  const faltan = CAMPOS_OBLIGATORIOS.filter((campo) => !presentes[campo]);
  if (!continuacion && faltan.length > 0) {
    return { ok: false, error: `Faltan parámetros obligatorios: ${faltan.join(", ")}.` };
  }

  let sigla = "";
  if (siglaRaw) {
    sigla = normalizarTexto(siglaRaw);
    if (!TIPOS_VIA_OFICIALES.some((item) => item.codigo === sigla)) {
      return {
        ok: false,
        error: "La sigla no es un tipo de vía del Anexo II. Indica sigla=CL, AV, PZ… No se asume CL.",
      };
    }
  }

  if (input.pageSize != null && (!Number.isFinite(input.pageSize) || input.pageSize < 1)) {
    return { ok: false, error: "El parámetro pageSize debe ser un entero mayor que 0." };
  }

  const filtro = parsearFiltroDivision(String(input.horizontalDivision ?? ""));
  if (!filtro.ok) return filtro;

  return {
    ok: true,
    criterios: {
      provincia: provincia ? normalizarTexto(provincia) : "",
      municipio: municipio ? normalizarTexto(municipio) : "",
      sigla,
      via: via ? normalizarTexto(via) : "",
      numero: input.numero?.replace(/\s+/g, "") || undefined,
      postalCode: input.postalCode?.replace(/\s+/g, "") || undefined,
      horizontalDivision: filtro.value,
      pageSize: acotar(input.pageSize, API_DEFAULT_MAX_PORTALS, API_MAX_PORTALS),
      cursor,
    },
  };
}

function esErrorServicio(error: ErrorCatastro): boolean {
  return error.codigo === "http" || error.codigo === "inspire";
}

function esNoEncontrado(error: ErrorCatastro): boolean {
  if (CODIGOS_NO_ENCONTRADO.has(error.codigo)) return true;
  return /NO EXISTE|NO HAY COINCIDENCIAS/i.test(error.descripcion);
}

function registrarObservabilidad(
  search: ResultadoBusquedaComercial["search"],
  coverage: CoberturaComercial,
  candidatos: ClasificacionCandidatos,
  extras: {
    durationMs: number;
    fetches: number;
    cacheHits: number;
    partialErrors: number;
    prefilter: PrefiltroCodigoPostal;
  }
) {
  console.info("[catastro:commercial-search]", {
    criteria: search,
    durationMs: extras.durationMs,
    portalsFound: coverage.portalsFound,
    portalsProcessed: coverage.portalsProcessed,
    fincas: candidatos.all.length,
    candidateNo: candidatos.withoutHorizontalDivision.length,
    yes: candidatos.withHorizontalDivision.length,
    ...recuentoReasonCodeUnknown(candidatos.all),
    notApplicable: candidatos.notApplicable.length,
    complete: coverage.complete,
    completeCandidates: coverage.completeCandidates,
    possibleCut: coverage.possibleCut,
    partialErrors: extras.partialErrors,
    cacheHits: extras.cacheHits,
    fetches: extras.fetches,
    prefilter: extras.prefilter,
  });
}

export async function buscarFincasComerciales(
  input: CriteriosBusquedaComercial,
  options: OpcionesBusquedaComercial = {}
): Promise<EjecucionBusquedaComercial | ErrorBusquedaComercial> {
  const parsed = normalizarCriterios(input);
  if (!parsed.ok) {
    return { ok: false, code: "invalid", error: parsed.error };
  }
  const criterios = parsed.criterios;
  const client = options.client ?? getCatastroClient();
  const store = options.store ?? getDiscoveryStore();
  const concurrency = acotar(
    options.concurrency,
    API_DEFAULT_CONCURRENCY,
    API_MAX_CONCURRENCY
  );
  const search = {
    provincia: criterios.provincia,
    municipio: criterios.municipio,
    sigla: criterios.sigla,
    via: criterios.via,
    ...(criterios.numero ? { numero: criterios.numero } : {}),
    ...(criterios.postalCode ? { postalCode: criterios.postalCode } : {}),
    horizontalDivision: criterios.horizontalDivision,
  };

  const antes = client.getStats();
  const started = Date.now();

  try {
    const result = await discoverFincas(
      {
        provincia: criterios.provincia || "PENDIENTE",
        municipio: criterios.municipio || "PENDIENTE",
        sigla: criterios.sigla || "CL",
        via: criterios.via || "PENDIENTE",
        numero: criterios.numero,
        postalCode: criterios.postalCode,
      },
      client,
      {
        maxPortals: criterios.pageSize,
        pageSize: criterios.pageSize,
        concurrency: Math.max(1, concurrency),
        cursor: criterios.cursor,
        paginated: !criterios.numero,
        store,
      }
    );

    search.provincia = result.query.provincia;
    search.municipio = result.query.municipio;
    search.sigla = result.query.sigla;
    search.via = result.query.via;
    if (result.query.numero) search.numero = result.query.numero;
    if (result.query.postalCode) search.postalCode = result.query.postalCode;

    const sesion = result.discovery.discoveryId
      ? store.get(result.discovery.discoveryId)
      : null;
    const fincasEvaluadas = sesion ? [...sesion.fincaSnapshots.values()] : result.fincas;
    const candidatos = clasificarCandidatos(fincasEvaluadas, {
      complete: result.discovery.complete,
      hasNextPage: result.discovery.hasNextPage,
      possibleCut: result.discovery.possibleCut,
      portalErrors:
        sesion?.portalErrors.size ?? result.portals.filter((portal) => portal.error).length,
    });
    const results = ordenarFincasComerciales(
      deduplicarFincas(filtrarPorDivision(result.fincas, criterios.horizontalDivision))
    );
    const coverage: CoberturaComercial = {
      complete: result.discovery.complete,
      completeCandidates: candidatos.completeCandidates,
      possibleCut: result.discovery.possibleCut,
      portalsFound: result.discovery.portalsFound,
      portalsProcessed: result.discovery.portalsProcessed,
    };
    const despues = client.getStats();
    registrarObservabilidad(search, coverage, candidatos, {
      durationMs: Date.now() - started,
      fetches: despues.fetches - antes.fetches,
      cacheHits: despues.cacheHits - antes.cacheHits,
      partialErrors: result.portals.filter((portal) => portal.error).length,
      prefilter: result.prefilter,
    });

    if (result.error && esErrorServicio(result.error)) {
      return { ok: false, code: "upstream", error: result.error, search };
    }
    if (result.error && esNoEncontrado(result.error)) {
      return { ok: false, code: "not_found", error: result.error, search };
    }
    if (result.error && result.fincas.length === 0 && result.discovery.cobertura !== "via-oficial") {
      return { ok: false, code: "not_found", error: result.error, search };
    }

    return {
      ok: true,
      resultado: {
        ok: true,
        search,
        results,
        pagination: {
          hasNextPage: result.discovery.hasNextPage,
          ...(result.discovery.nextCursor ? { nextCursor: result.discovery.nextCursor } : {}),
        },
        coverage,
      },
      discovery: result,
      candidatos,
    };
  } catch (error) {
    if (error instanceof DiscoverySessionError) {
      return {
        ok: false,
        code: error.code === "expired" ? "expired" : "invalid",
        error: error.message,
        search,
      };
    }
    const message =
      error instanceof CatastroHttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Error al consultar Catastro";
    console.error("[catastro:commercial-search]", message);
    return {
      ok: false,
      code: "upstream",
      error: "Error externo de Catastro o INSPIRE.",
      search,
    };
  }
}
