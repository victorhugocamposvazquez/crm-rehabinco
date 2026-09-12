import { getCatastroClient, type CatastroClient } from "./client";
import {
  API_DEFAULT_CONCURRENCY,
  API_DEFAULT_MAX_PORTALS,
  API_MAX_CONCURRENCY,
  API_MAX_PORTALS,
  TIPOS_VIA_OFICIALES,
} from "./constants";
import { discoverFincas, DiscoverySessionError } from "./discovery";
import type {
  DiscoveryQuery,
  DiscoveryResult,
  FincaDescubierta,
  PortalDescubierto,
} from "./discovery";
import {
  clasificarCandidatos,
  filtrarPorDivision,
  parsearFiltroDivision,
  type ClasificacionCandidatos,
  type FiltroDivisionHorizontal,
} from "./candidates";
import { getDiscoveryStore, type DiscoverySessionStore } from "./discovery-session";
import { CatastroHttpError } from "./http";
import type { ErrorCatastro } from "./types";
import type { UnknownReason } from "./unknown-reason";
import { recuentoReasonCodeUnknown } from "./unknown-reason";

export type DiscoveryApiQuery = {
  provincia: string;
  municipio: string;
  sigla: string;
  via: string;
  numero: string | null;
  postalCode: string | null;
};

export type DiscoveryApiOptions = {
  maxPortals: number;
  pageSize: number;
  concurrency: number;
  cursor: string | null;
  discoveryId: string | null;
  page: number | null;
  horizontalDivision: FiltroDivisionHorizontal;
};

export type DiscoveryApiPortal = {
  number: string;
  processed: boolean;
  skipReason: "maxPortals" | null;
  error: ErrorCatastro | null;
  propertyReferences: string[];
  fincaReferences: string[];
  postalCode: string | null;
};

export type DiscoveryApiFinca = {
  fincaReference: string;
  propertyReferences: string[];
  properties: FincaDescubierta["properties"];
  portals: string[];
  address: {
    provincia: string;
    municipio: string;
    sigla: string;
    via: string;
    numero: string | null;
    numero2: string | null;
    literal: string | null;
  };
  postalCode: string | null;
  postalCodes: string[];
  ltp: string | null;
  superficieSolar: number | null;
  horizontalDivision: {
    status: "YES" | "NO" | "UNKNOWN" | "NOT_APPLICABLE";
    confidence: number;
    reason: string;
    reasonCode?: UnknownReason;
  };
};

export type DiscoveryApiDiscovery = {
  source: string | null;
  portalsFound: number;
  portalsProcessed: number;
  truncated: boolean;
  possibleCut: boolean;
  complete: boolean;
  cobertura: string;
  limitation: string | null;
  discoveryId: string | null;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  nextCursor: string | null;
  completeCandidates: boolean;
};

export type DiscoveryApiOk = {
  ok: true;
  query: DiscoveryApiQuery;
  discovery: DiscoveryApiDiscovery;
  fincas: DiscoveryApiFinca[];
  portals: DiscoveryApiPortal[];
};

export type DiscoveryApiError = {
  ok: false;
  error: string | ErrorCatastro;
  query?: DiscoveryApiQuery;
};

const CAMPOS_OBLIGATORIOS = ["provincia", "municipio", "sigla", "via"] as const;
const CODIGOS_NO_ENCONTRADO = new Set(["10", "33"]);

function leer(params: URLSearchParams, nombre: string): string {
  return params.get(nombre)?.trim() ?? "";
}

function normalizarTexto(valor: string): string {
  return valor.trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizarNumero(valor: string): string {
  return valor.trim().replace(/\s+/g, "");
}

function enteroOpcional(
  raw: string,
  nombre: string
): { ok: true; value?: number } | { ok: false; error: string } {
  if (!raw) return { ok: true };
  if (!/^\d+$/.test(raw)) {
    return { ok: false, error: `El parámetro ${nombre} debe ser un entero no negativo.` };
  }
  return { ok: true, value: Number(raw) };
}

function acotar(valor: number | undefined, defecto: number, maximo: number): number {
  if (valor == null) return defecto;
  return Math.min(valor, maximo);
}

export function parsearDiscovery(
  params: URLSearchParams
):
  | { ok: true; query: DiscoveryApiQuery | null; options: DiscoveryApiOptions }
  | { ok: false; error: string } {
  const cursor = leer(params, "cursor") || null;
  const discoveryId = leer(params, "discoveryId") || null;
  const viaRaw = leer(params, "via") || leer(params, "calle");
  const presentes = {
    provincia: leer(params, "provincia"),
    municipio: leer(params, "municipio"),
    sigla: leer(params, "sigla"),
    via: viaRaw,
  };
  const continuacion = Boolean(cursor || discoveryId);
  const faltan = CAMPOS_OBLIGATORIOS.filter((campo) => !presentes[campo]);
  if (!continuacion && faltan.length > 0) {
    return {
      ok: false,
      error: `Faltan parámetros obligatorios: ${faltan.join(", ")}.`,
    };
  }

  let query: DiscoveryApiQuery | null = null;
  if (faltan.length === 0) {
    const sigla = normalizarTexto(presentes.sigla);
    if (!TIPOS_VIA_OFICIALES.some((item) => item.codigo === sigla)) {
      return {
        ok: false,
        error:
          "La sigla no es un tipo de vía del Anexo II. Indica sigla=CL, AV, PZ… No se asume CL.",
      };
    }
    const numero = normalizarNumero(leer(params, "numero"));
    const postalCode = normalizarNumero(leer(params, "postalCode") || leer(params, "codigoPostal"));
    query = {
      provincia: normalizarTexto(presentes.provincia),
      municipio: normalizarTexto(presentes.municipio),
      sigla,
      via: normalizarTexto(presentes.via),
      numero: numero || null,
      postalCode: postalCode || null,
    };
  } else if (leer(params, "postalCode") || leer(params, "codigoPostal")) {
    query = {
      provincia: "",
      municipio: "",
      sigla: "",
      via: "",
      numero: null,
      postalCode: normalizarNumero(leer(params, "postalCode") || leer(params, "codigoPostal")),
    };
  }

  const maxPortalsRaw = enteroOpcional(leer(params, "maxPortals"), "maxPortals");
  if (!maxPortalsRaw.ok) return maxPortalsRaw;
  const pageSizeRaw = enteroOpcional(leer(params, "pageSize"), "pageSize");
  if (!pageSizeRaw.ok) return pageSizeRaw;
  const concurrencyRaw = enteroOpcional(leer(params, "concurrency"), "concurrency");
  if (!concurrencyRaw.ok) return concurrencyRaw;
  if (concurrencyRaw.value === 0) {
    return { ok: false, error: "El parámetro concurrency debe ser un entero mayor que 0." };
  }
  const pageRaw = enteroOpcional(leer(params, "page"), "page");
  if (!pageRaw.ok) return pageRaw;
  if (pageRaw.value === 0) {
    return { ok: false, error: "El parámetro page debe ser un entero mayor que 0." };
  }

  const pageSize = acotar(
    pageSizeRaw.value ?? maxPortalsRaw.value,
    API_DEFAULT_MAX_PORTALS,
    API_MAX_PORTALS
  );
  const filtro = parsearFiltroDivision(leer(params, "horizontalDivision"));
  if (!filtro.ok) return filtro;

  return {
    ok: true,
    query,
    options: {
      maxPortals: pageSize,
      pageSize,
      concurrency: Math.max(
        1,
        acotar(concurrencyRaw.value, API_DEFAULT_CONCURRENCY, API_MAX_CONCURRENCY)
      ),
      cursor,
      discoveryId,
      page: pageRaw.value ?? null,
      horizontalDivision: filtro.value,
    },
  };
}

function portalPublico(portal: PortalDescubierto): DiscoveryApiPortal {
  return {
    number: portal.number,
    processed: portal.processed,
    skipReason: portal.skipReason ?? null,
    error: portal.error,
    propertyReferences: portal.propertyReferences,
    fincaReferences: portal.fincaReferences,
    postalCode: portal.postalCode ?? null,
  };
}

function fincaPublica(finca: FincaDescubierta, query: DiscoveryApiQuery): DiscoveryApiFinca {
  return {
    fincaReference: finca.fincaReference,
    propertyReferences: finca.propertyReferences,
    properties: finca.properties,
    portals: finca.portals,
    address: {
      provincia: finca.address.provincia ?? query.provincia,
      municipio: finca.address.municipio ?? query.municipio,
      sigla: finca.address.sigla ?? query.sigla,
      via: finca.address.via ?? query.via,
      numero: finca.address.numero ?? null,
      numero2: finca.address.numero2 ?? null,
      literal: finca.address.literal ?? null,
    },
    postalCode: finca.postalCode ?? null,
    postalCodes: finca.postalCodes,
    ltp: finca.ltp ?? null,
    superficieSolar: finca.superficieSolar ?? null,
    horizontalDivision: {
      status: finca.horizontalDivision.status,
      confidence: finca.horizontalDivision.confidence,
      reason: finca.horizontalDivision.reason,
      ...(finca.horizontalDivision.reasonCode
        ? { reasonCode: finca.horizontalDivision.reasonCode }
        : {}),
    },
  };
}

function discoveryPublica(
  result: DiscoveryResult,
  completeCandidates: boolean
): DiscoveryApiDiscovery {
  return {
    source: result.discovery.source,
    portalsFound: result.discovery.portalsFound,
    portalsProcessed: result.discovery.portalsProcessed,
    truncated: result.discovery.truncated,
    possibleCut: result.discovery.possibleCut,
    complete: result.discovery.complete,
    cobertura: result.discovery.cobertura,
    limitation: result.discovery.limitation,
    discoveryId: result.discovery.discoveryId,
    page: result.discovery.page,
    pageSize: result.discovery.pageSize,
    hasNextPage: result.discovery.hasNextPage,
    nextCursor: result.discovery.nextCursor,
    completeCandidates,
  };
}

function esErrorServicio(error: ErrorCatastro): boolean {
  return error.codigo === "http" || error.codigo === "inspire";
}

function esNoEncontrado(error: ErrorCatastro): boolean {
  if (CODIGOS_NO_ENCONTRADO.has(error.codigo)) return true;
  return /NO EXISTE|NO HAY COINCIDENCIAS/i.test(error.descripcion);
}

function respuestaOk(
  result: DiscoveryResult,
  query: DiscoveryApiQuery,
  filtro: FiltroDivisionHorizontal,
  candidatos: ClasificacionCandidatos
): DiscoveryApiOk {
  return {
    ok: true,
    query,
    discovery: discoveryPublica(result, candidatos.completeCandidates),
    fincas: filtrarPorDivision(result.fincas, filtro).map((finca) => fincaPublica(finca, query)),
    portals: result.portals.map(portalPublico),
  };
}

function registrarObservabilidad(
  query: DiscoveryApiQuery,
  result: DiscoveryResult,
  candidatos: ClasificacionCandidatos,
  stats: { durationMs: number; fetches: number; cacheHits: number }
) {
  const erroresParciales = result.portals.filter((portal) => portal.error).length;
  console.info("[catastro:search]", {
    provincia: query.provincia,
    municipio: query.municipio,
    via: query.via,
    numero: query.numero,
    durationMs: stats.durationMs,
    fetches: stats.fetches,
    cacheHits: stats.cacheHits,
    portalsFound: result.discovery.portalsFound,
    portalsProcessed: result.discovery.portalsProcessed,
    fincas: candidatos.all.length,
    yes: candidatos.withHorizontalDivision.length,
    no: candidatos.withoutHorizontalDivision.length,
    ...recuentoReasonCodeUnknown(candidatos.all),
    notApplicable: candidatos.notApplicable.length,
    candidateNo: candidatos.withoutHorizontalDivision.length,
    completeCandidates: candidatos.completeCandidates,
    partialErrors: erroresParciales,
    truncated: result.discovery.truncated,
    possibleCut: result.discovery.possibleCut,
    complete: result.discovery.complete,
  });
}

export async function responderDiscoveryCatastro(
  request: Request,
  user: { id: string } | null,
  client: CatastroClient = getCatastroClient(),
  store: DiscoverySessionStore = getDiscoveryStore()
): Promise<Response> {
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" } satisfies DiscoveryApiError, {
      status: 401,
    });
  }

  const parsed = parsearDiscovery(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return Response.json({ ok: false, error: parsed.error } satisfies DiscoveryApiError, {
      status: 400,
    });
  }

  const { query, options } = parsed;
  if (!query && !options.cursor && !options.discoveryId) {
    return Response.json(
      { ok: false, error: "Faltan parámetros obligatorios: provincia, municipio, sigla, via." },
      { status: 400 }
    );
  }

  const input: DiscoveryQuery = {
    provincia: query?.provincia || "PENDIENTE",
    municipio: query?.municipio || "PENDIENTE",
    sigla: query?.sigla || "CL",
    via: query?.via || "PENDIENTE",
    numero: query?.numero ?? undefined,
    postalCode: query?.postalCode ?? undefined,
  };

  const antes = client.getStats();
  const started = Date.now();

  try {
    const result = await discoverFincas(input, client, {
      maxPortals: options.pageSize,
      pageSize: options.pageSize,
      concurrency: options.concurrency,
      cursor: options.cursor ?? undefined,
      discoveryId: options.discoveryId ?? undefined,
      page: options.page ?? undefined,
      paginated: !input.numero,
      store,
    });
    const queryRespuesta: DiscoveryApiQuery = {
      provincia: result.query.provincia,
      municipio: result.query.municipio,
      sigla: result.query.sigla,
      via: result.query.via,
      numero: result.query.numero ?? null,
      postalCode: result.query.postalCode ?? query?.postalCode ?? null,
    };
    const sesion = result.discovery.discoveryId
      ? store.get(result.discovery.discoveryId)
      : null;
    const fincasEvaluadas = sesion
      ? [...sesion.fincaSnapshots.values()]
      : result.fincas;
    const candidatos = clasificarCandidatos(fincasEvaluadas, {
      complete: result.discovery.complete,
      hasNextPage: result.discovery.hasNextPage,
      possibleCut: result.discovery.possibleCut,
      portalErrors:
        sesion?.portalErrors.size ?? result.portals.filter((portal) => portal.error).length,
    });
    const despues = client.getStats();
    registrarObservabilidad(queryRespuesta, result, candidatos, {
      durationMs: Date.now() - started,
      fetches: despues.fetches - antes.fetches,
      cacheHits: despues.cacheHits - antes.cacheHits,
    });

    if (result.error && esErrorServicio(result.error)) {
      return Response.json(
        { ok: false, error: result.error, query: queryRespuesta } satisfies DiscoveryApiError,
        { status: 502 }
      );
    }

    if (result.error && esNoEncontrado(result.error)) {
      return Response.json(
        { ok: false, error: result.error, query: queryRespuesta } satisfies DiscoveryApiError,
        { status: 404 }
      );
    }

    if (result.error && result.fincas.length === 0 && result.discovery.cobertura !== "via-oficial") {
      return Response.json(
        { ok: false, error: result.error, query: queryRespuesta } satisfies DiscoveryApiError,
        { status: 404 }
      );
    }

    return Response.json(
      respuestaOk(result, queryRespuesta, options.horizontalDivision, candidatos)
    );
  } catch (error) {
    if (error instanceof DiscoverySessionError) {
      return Response.json(
        { ok: false, error: error.message } satisfies DiscoveryApiError,
        { status: error.code === "expired" ? 410 : 400 }
      );
    }
    const message =
      error instanceof CatastroHttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Error al consultar Catastro";
    console.error("[catastro:search]", message);
    return Response.json(
      {
        ok: false,
        error: "Error externo de Catastro o INSPIRE.",
        query: query ?? undefined,
      } satisfies DiscoveryApiError,
      { status: 502 }
    );
  }
}
