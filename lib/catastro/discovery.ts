/**
 * Discovery de fincas por dirección.
 *
 * Con número: Consulta_DNPLOC → agrupa 14 chars → resuelve finca.ltp.
 * Sin número: ObtenerMunicipios + ObtenerCallejero → INSPIRE GetADByCodVIA
 * → Consulta_DNPLOC por cada portal oficial (lotes, concurrencia limitada).
 *
 * Orden sin CP: INSPIRE → DNPLOC → agrupación → ltp → clasificar DH.
 * Orden con CP: INSPIRE → DNPLOC → prefiltro seguro por CP → agrupación
 * de fincas supervivientes → ltp → clasificar DH → filtro CP final.
 * El código postal nunca se envía a Catastro. El prefiltro no infiere `ltp`.
 */
import { getCatastroClient, type CatastroClient } from "./client";
import {
  DEFAULT_DISCOVERY_CONCURRENCY,
  DEFAULT_MAX_PORTALS,
  MAX_DISCOVERY_CONCURRENCY,
} from "./constants";
import { fusionarFincas } from "./candidates";
import {
  decodeDiscoveryCursor,
  encodeDiscoveryCursor,
  getDiscoveryStore,
  portalesAcumulados,
  recordarFincaEnSesion,
  referenciasAcumuladas,
  type DiscoverySession,
  type DiscoverySessionStore,
} from "./discovery-session";
import {
  coincideCodigoPostal,
  codigosPostalesOficiales,
  direccionOficialDeFinca,
  propiedadesDesdeInmuebles,
  seleccionarFincasParaResolverLtp,
  PREFILTRO_CODIGO_POSTAL_VACIO,
  superficieSolarOficial,
  type DireccionFinca,
  type FincaDescubierta,
  type PrefiltroCodigoPostal,
} from "./finca";
import { evaluarAplicabilidadDh } from "./applicability";
import { reasonCodeUnknownDe } from "./unknown-reason";
import { asArray, asRecord, asString } from "./parse";
import { parsearDireccionesInspire, numerosOficiales } from "./inspire-ad";
import { mapWithConcurrency } from "./pool";
import { agruparPorFinca, clasificarFincaPorLtp } from "./resolve-finca-ltp";
import { getFincaReference, getPropertyReference } from "./references";
import type {
  ErrorCatastro,
  InmuebleNormalizado,
  JsonValue,
} from "./types";
import { CatastroHttpError } from "./http";

export type { DireccionFinca, FincaDescubierta };

export type DiscoveryInput = {
  provincia: string;
  municipio: string;
  sigla: string;
  via: string;
  numero?: string;
  codigoPostal?: string;
  postalCode?: string;
};

export type DiscoveryOptions = {
  /** Tope operativo / tamaño de página de Consulta_DNPLOC. */
  maxPortals?: number;
  pageSize?: number;
  concurrency?: number;
  cursor?: string;
  discoveryId?: string;
  offset?: number;
  page?: number;
  /** Si true, no adjunta el resto de la calle como skipReason: va en la siguiente página. */
  paginated?: boolean;
  store?: DiscoverySessionStore;
};

export type DiscoveryQuery = {
  provincia: string;
  municipio: string;
  sigla: string;
  via: string;
  numero?: string;
  postalCode?: string;
};

export type DiscoverySource = "INSPIRE_AD" | "DNPLOC" | null;

export type DiscoveryMeta = {
  source: DiscoverySource;
  portalsFound: number;
  portalsProcessed: number;
  truncated: boolean;
  possibleCut: boolean;
  complete: boolean;
  cobertura: "numero" | "via-oficial" | "no-disponible";
  limitation: string | null;
  discoveryId: string | null;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  nextCursor: string | null;
};

export class DiscoverySessionError extends Error {
  constructor(
    message: string,
    readonly code: "expired" | "invalid"
  ) {
    super(message);
    this.name = "DiscoverySessionError";
  }
}

export type PortalDescubierto = {
  number: string;
  processed: boolean;
  skipReason?: "maxPortals";
  error: ErrorCatastro | null;
  propertyReferences: string[];
  fincaReferences: string[];
  postalCode?: string;
};

export type DiscoveryResult = {
  query: DiscoveryQuery;
  discovery: DiscoveryMeta;
  portals: PortalDescubierto[];
  fincas: FincaDescubierta[];
  error: ErrorCatastro | null;
  raw: JsonValue | null;
  /** Compatibilidad Fase 4. */
  cobertura: DiscoveryMeta["cobertura"];
  numerosOficiales: string[];
  /** Interno: no forma parte del contrato HTTP. */
  prefilter: PrefiltroCodigoPostal;
};

const LIMITACION_CALLEJERO =
  "Consulta_DNPLOC y ObtenerNumerero exigen el parámetro oficial Numero (error 41). No listan todos los portales de una vía.";

function extraerErrorOficial(raw: unknown): ErrorCatastro | null {
  const root = asRecord(raw);
  if (!root) return null;
  const payload =
    asRecord(root.consulta_municipieroResult) ??
    asRecord(root.consulta_callejeroResult) ??
    root;
  const lerr = payload?.lerr;
  const items = asArray(asRecord(lerr)?.err ?? lerr);
  const primero = asRecord(items[0]);
  const codigo = asString(primero?.cod);
  const descripcion = asString(primero?.des);
  if (!codigo && !descripcion) return null;
  return { codigo: codigo ?? "", descripcion: descripcion ?? "" };
}

function errorDeExcepcion(error: unknown): ErrorCatastro {
  if (error instanceof CatastroHttpError) {
    return { codigo: "http", descripcion: error.message };
  }
  if (error instanceof Error) {
    return { codigo: "http", descripcion: error.message };
  }
  return { codigo: "http", descripcion: "Error al consultar Catastro" };
}

function referenciasCompletas(inmuebles: InmuebleNormalizado[]): string[] {
  return [
    ...new Set(
      inmuebles
        .map((item) => getPropertyReference(item.referenciaCatastral))
        .filter((ref): ref is string => Boolean(ref))
    ),
  ].sort();
}

function referenciasFinca(inmuebles: InmuebleNormalizado[]): string[] {
  return [
    ...new Set(
      inmuebles
        .map(
          (item) =>
            getFincaReference(item.referenciaParcela) ??
            getFincaReference(item.referenciaCatastral)
        )
        .filter((ref): ref is string => Boolean(ref))
    ),
  ].sort();
}

function resolverTope(valor: number | undefined): number {
  if (valor == null) return DEFAULT_MAX_PORTALS;
  if (!Number.isFinite(valor)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor(valor));
}

function resolverConcurrency(valor: number | undefined): number {
  if (valor == null || !Number.isFinite(valor) || valor < 1) {
    return DEFAULT_DISCOVERY_CONCURRENCY;
  }
  return Math.min(MAX_DISCOVERY_CONCURRENCY, Math.floor(valor));
}

function elegirMunicipio(
  raw: unknown,
  municipio: string
): { delegacion: string; municipio: string } | null {
  const root = asRecord(raw);
  const payload = asRecord(root?.consulta_municipieroResult) ?? root;
  const lista = asRecord(payload?.municipiero);
  const objetivo = municipio.trim().toUpperCase();
  const exacto = asArray(lista?.muni).find((item) => {
    const record = asRecord(item);
    return asString(record?.nm)?.toUpperCase() === objetivo;
  });
  const locat = asRecord(asRecord(exacto)?.locat);
  const delegacion = asString(locat?.cd);
  const codigo = asString(locat?.cmc);
  if (!delegacion || !codigo) return null;
  return { delegacion, municipio: codigo };
}

function elegirCodigoVia(raw: unknown, sigla: string, via: string): string | null {
  const root = asRecord(raw);
  const payload = asRecord(root?.consulta_callejeroResult) ?? root;
  const lista = asRecord(payload?.callejero);
  const viaMayus = via.trim().toUpperCase();
  const siglaMayus = sigla.trim().toUpperCase();
  const exacta = asArray(lista?.calle).find((item) => {
    const dir = asRecord(asRecord(item)?.dir);
    return (
      asString(dir?.tv)?.toUpperCase() === siglaMayus &&
      asString(dir?.nv)?.toUpperCase() === viaMayus
    );
  });
  return asString(asRecord(asRecord(exacta)?.dir)?.cv);
}

async function descubrirNumerosOficiales(
  input: DiscoveryQuery,
  client: CatastroClient
): Promise<{
  numeros: string[];
  possibleCut: boolean;
  limitation: string | null;
  error: ErrorCatastro | null;
  raw: JsonValue | null;
}> {
  const municipios = await client.obtenerMunicipios(input.provincia, input.municipio);
  const errorMunicipio = extraerErrorOficial(municipios);
  const codes = elegirMunicipio(municipios, input.municipio);
  if (!codes) {
    return {
      numeros: [],
      possibleCut: false,
      error: errorMunicipio,
      raw: municipios,
      limitation: errorMunicipio
        ? `${LIMITACION_CALLEJERO} GetADByCodVIA requiere el código de municipio (locat.cmc).`
        : `${LIMITACION_CALLEJERO} No hay coincidencia exacta de municipio para GetADByCodVIA.`,
    };
  }

  const callejero = await client.obtenerCallejero({
    provincia: input.provincia,
    municipio: input.municipio,
    tipoVia: input.sigla,
    nomVia: input.via,
  });
  const errorVia = extraerErrorOficial(callejero);
  const codigoVia = elegirCodigoVia(callejero, input.sigla, input.via);
  if (!codigoVia) {
    return {
      numeros: [],
      possibleCut: false,
      error: errorVia,
      raw: callejero,
      limitation: errorVia
        ? `${LIMITACION_CALLEJERO} GetADByCodVIA requiere el código de vía (dir.cv).`
        : `${LIMITACION_CALLEJERO} No hay coincidencia exacta de vía para GetADByCodVIA.`,
    };
  }

  let gml: string;
  try {
    gml = await client.obtenerDireccionesPorCodigoVia({
      delegacion: codes.delegacion,
      municipio: codes.municipio,
      codigoVia,
    });
  } catch (error) {
    // Vía oficial sin direcciones INSPIRE: el WFS redirige a /OVCError.aspx (HTTP 404).
    // Verificado con Godelleta (DS DISEMINADO P 1, UR EL BOSQUE 1). No es una caída del servicio.
    if (error instanceof CatastroHttpError && error.status === 404) {
      return {
        numeros: [],
        possibleCut: false,
        error: null,
        raw: callejero,
        limitation: `${LIMITACION_CALLEJERO} INSPIRE GetADByCodVIA no tiene direcciones para esta vía (HTTP 404).`,
      };
    }
    throw error;
  }
  if (/ExceptionReport/i.test(gml)) {
    return {
      numeros: [],
      possibleCut: false,
      error: {
        codigo: "inspire",
        descripcion: "El WFS AD devolvió ExceptionReport en GetADByCodVIA.",
      },
      raw: null,
      limitation: LIMITACION_CALLEJERO,
    };
  }

  const parsed = parsearDireccionesInspire(gml);
  const numeros = numerosOficiales(parsed.direcciones);
  return {
    numeros,
    possibleCut: parsed.posibleCorte,
    error: null,
    raw: callejero,
    limitation: parsed.posibleCorte
      ? "El WFS AD puede cortar en 5000 elementos o 4 km²; no se puede afirmar que estén todos los portales de la calle."
      : null,
  };
}

function portalVacio(number: string, extra: Partial<PortalDescubierto> = {}): PortalDescubierto {
  return {
    number,
    processed: false,
    error: null,
    propertyReferences: [],
    fincaReferences: [],
    ...extra,
  };
}

function paginacionVacia(pageSize: number): Pick<
  DiscoveryMeta,
  "discoveryId" | "page" | "pageSize" | "hasNextPage" | "nextCursor"
> {
  return {
    discoveryId: null,
    page: 1,
    pageSize,
    hasNextPage: false,
    nextCursor: null,
  };
}

function resultado(params: {
  query: DiscoveryQuery;
  discovery: Omit<DiscoveryMeta, "complete"> & { complete?: boolean };
  portals: PortalDescubierto[];
  fincas: FincaDescubierta[];
  error: ErrorCatastro | null;
  raw: JsonValue | null;
  numerosOficiales?: string[];
  prefilter?: PrefiltroCodigoPostal;
}): DiscoveryResult {
  const merged = {
    ...{
      discoveryId: null as string | null,
      page: 1,
      pageSize: params.discovery.portalsProcessed,
      hasNextPage: false,
      nextCursor: null as string | null,
    },
    ...params.discovery,
  };
  const complete =
    params.discovery.complete ??
    (params.error == null && !merged.possibleCut && !merged.truncated);
  const discovery: DiscoveryMeta = { ...merged, complete };
  return {
    query: params.query,
    discovery,
    portals: params.portals,
    fincas: params.fincas,
    error: params.error,
    raw: params.raw,
    cobertura: discovery.cobertura,
    numerosOficiales:
      params.numerosOficiales ?? params.portals.map((item) => item.number),
    prefilter: params.prefilter ?? { ...PREFILTRO_CODIGO_POSTAL_VACIO },
  };
}

async function consultarPortal(
  query: DiscoveryQuery,
  numero: string,
  client: CatastroClient
): Promise<{
  portal: PortalDescubierto;
  inmuebles: InmuebleNormalizado[];
  raw: JsonValue | null;
}> {
  try {
    const consulta = await client.consultarDireccion({
      provincia: query.provincia,
      municipio: query.municipio,
      sigla: query.sigla,
      calle: query.via,
      numero,
    });

    if (consulta.error) {
      return {
        portal: portalVacio(numero, {
          processed: false,
          error: consulta.error,
        }),
        inmuebles: [],
        raw: consulta.raw,
      };
    }

    const inmuebles = consulta.results;
    return {
      portal: portalVacio(numero, {
        processed: true,
        propertyReferences: referenciasCompletas(inmuebles),
        fincaReferences: referenciasFinca(inmuebles),
        postalCode: codigosPostalesOficiales(inmuebles)[0],
      }),
      inmuebles,
      raw: consulta.raw,
    };
  } catch (error) {
    return {
      portal: portalVacio(numero, {
        processed: false,
        error: errorDeExcepcion(error),
      }),
      inmuebles: [],
      raw: null,
    };
  }
}

async function fincasDesdeInmuebles(
  inmuebles: InmuebleNormalizado[],
  portals: PortalDescubierto[],
  query: DiscoveryQuery,
  client: CatastroClient,
  session: DiscoverySession | null = null
): Promise<{ fincas: FincaDescubierta[]; prefilter: PrefiltroCodigoPostal }> {
  const agrupadas = agruparPorFinca(inmuebles);
  const { grupos, stats } = seleccionarFincasParaResolverLtp(agrupadas, query.postalCode);
  const fincas: FincaDescubierta[] = [];

  for (const [parcela, grupo] of grupos) {
    const aplicabilidad = evaluarAplicabilidadDh(grupo);
    const clasificacion = aplicabilidad.aplicable
      ? await clasificarFincaPorLtp(grupo, client, parcela)
      : {
          status: aplicabilidad.status,
          confidence: 1,
          reason: aplicabilidad.reason,
          rawLtp: null as string | null,
          superficieSolar: superficieSolarOficial(grupo),
        };
    const postalCodes = codigosPostalesOficiales(grupo);
    if (!coincideCodigoPostal(postalCodes, query.postalCode)) continue;

    const portalsPagina = [
      ...new Set(
        portals
          .filter((portal) => portal.fincaReferences.includes(parcela))
          .map((portal) => portal.number)
      ),
    ];
    const propertyReferences = referenciasCompletas(grupo);
    if (session) {
      recordarFincaEnSesion(session, parcela, portalsPagina, propertyReferences);
    }

    const reasonCode = reasonCodeUnknownDe({
      status: clasificacion.status,
      reason: clasificacion.reason,
      rawLtp: clasificacion.rawLtp,
    });
    const finca: FincaDescubierta = {
      fincaReference: parcela,
      propertyReferences: session ? referenciasAcumuladas(session, parcela) : propertyReferences,
      properties: propiedadesDesdeInmuebles(grupo),
      portals: session
        ? portalesAcumulados(session, parcela)
        : portalsPagina.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, "es")),
      address: direccionOficialDeFinca(grupo, query),
      postalCode: postalCodes[0],
      postalCodes,
      ltp: clasificacion.rawLtp ?? undefined,
      superficieSolar: clasificacion.superficieSolar,
      horizontalDivision: {
        status: clasificacion.status,
        confidence: clasificacion.confidence,
        reason: clasificacion.reason,
        ...(reasonCode ? { reasonCode } : {}),
      },
    };
    if (session) {
      session.fincaSnapshots.set(parcela, fusionarFincas(session.fincaSnapshots.get(parcela), finca));
    }
    fincas.push(finca);
  }

  return {
    fincas: fincas.sort((a, b) => a.fincaReference.localeCompare(b.fincaReference)),
    prefilter: stats,
  };
}

function normalizarQuery(input: DiscoveryInput): DiscoveryQuery {
  const postalCode = (input.postalCode ?? input.codigoPostal)?.trim() || undefined;
  return {
    provincia: input.provincia.trim(),
    municipio: input.municipio.trim(),
    sigla: input.sigla.trim().toUpperCase(),
    via: input.via.trim(),
    numero: input.numero?.trim() || undefined,
    postalCode,
  };
}

function resolverPageSize(options: DiscoveryOptions): number {
  return resolverTope(options.pageSize ?? options.maxPortals);
}

function resolverSesion(
  options: DiscoveryOptions
): { session: DiscoverySession | null; offset: number } {
  const store = options.store ?? getDiscoveryStore();
  const cursorRaw = options.cursor?.trim();
  if (cursorRaw) {
    const cursor = decodeDiscoveryCursor(cursorRaw);
    if (!cursor) {
      throw new DiscoverySessionError("El cursor de discovery no es válido.", "invalid");
    }
    const session = store.get(cursor.id);
    if (!session) {
      throw new DiscoverySessionError("La sesión de discovery ha expirado.", "expired");
    }
    store.touch(session);
    return { session, offset: cursor.offset };
  }

  if (options.discoveryId) {
    const session = store.get(options.discoveryId);
    if (!session) {
      throw new DiscoverySessionError("La sesión de discovery ha expirado.", "expired");
    }
    store.touch(session);
    if (options.page != null && options.page > 0) {
      return { session, offset: (options.page - 1) * session.pageSize };
    }
    return { session, offset: options.offset ?? 0 };
  }

  return { session: null, offset: options.offset ?? 0 };
}

export async function discoverFincas(
  input: DiscoveryInput,
  client: CatastroClient = getCatastroClient(),
  options: DiscoveryOptions = {}
): Promise<DiscoveryResult> {
  const query = normalizarQuery(input);
  const pageSize = resolverPageSize(options);
  const concurrency = resolverConcurrency(options.concurrency);
  const paginated = Boolean(
    options.paginated || options.cursor || options.discoveryId || (options.offset ?? 0) > 0
  );

  if (query.numero) {
    const { portal, inmuebles, raw } = await consultarPortal(query, query.numero, client);
    const { fincas, prefilter } = await fincasDesdeInmuebles(inmuebles, [portal], query, client);
    return resultado({
      query,
      discovery: {
        source: "DNPLOC",
        portalsFound: 1,
        portalsProcessed: 1,
        truncated: false,
        possibleCut: false,
        cobertura: "numero",
        limitation: null,
        ...paginacionVacia(1),
      },
      portals: [portal],
      fincas,
      error: portal.error,
      raw,
      prefilter,
    });
  }

  const store = options.store ?? getDiscoveryStore();
  let session: DiscoverySession | null = null;
  let offset = 0;
  if (paginated || options.cursor || options.discoveryId) {
    const resuelta = resolverSesion(options);
    session = resuelta.session;
    offset = resuelta.offset;
  }

  let numeros: string[];
  let possibleCut = false;
  let limitation: string | null = null;
  let errorBase: ErrorCatastro | null = null;
  let rawBase: JsonValue | null = null;

  if (session) {
    numeros = session.numeros;
    possibleCut = session.possibleCut;
    limitation = session.limitation;
    query.provincia = session.query.provincia;
    query.municipio = session.query.municipio;
    query.sigla = session.query.sigla;
    query.via = session.query.via;
    if (!query.postalCode) query.postalCode = session.query.postalCode;
  } else {
    const descubiertos = await descubrirNumerosOficiales(query, client);
    numeros = descubiertos.numeros;
    possibleCut = descubiertos.possibleCut;
    limitation = descubiertos.limitation;
    errorBase = descubiertos.error;
    rawBase = descubiertos.raw;
  }

  if (numeros.length === 0) {
    return resultado({
      query,
      discovery: {
        source: "INSPIRE_AD",
        portalsFound: 0,
        portalsProcessed: 0,
        truncated: false,
        possibleCut: false,
        cobertura: "no-disponible",
        limitation:
          limitation ??
          `${LIMITACION_CALLEJERO} INSPIRE GetADByCodVIA no devolvió portales para esa vía.`,
        ...paginacionVacia(pageSize),
      },
      portals: [],
      fincas: [],
      error: errorBase,
      raw: rawBase,
    });
  }

  if (!session && paginated) {
    session = store.create({
      query,
      numeros,
      possibleCut,
      limitation,
      pageSize,
    });
  }

  const size = session?.pageSize && paginated ? session.pageSize : pageSize;
  const efectivo = Math.min(size, pageSize);
  const aProcesar = numeros.slice(offset, offset + efectivo);
  const resto = numeros.slice(offset + aProcesar.length);
  const hasNextPage = resto.length > 0;
  const truncated = hasNextPage;

  const lotes = await mapWithConcurrency(aProcesar, concurrency, (numero) =>
    consultarPortal(query, numero, client)
  );

  if (session) {
    for (const numero of aProcesar) session.processed.add(numero);
    for (const lote of lotes) {
      if (lote.portal.error) session.portalErrors.add(lote.portal.number);
    }
    store.touch(session);
  }

  const portals: PortalDescubierto[] = [
    ...lotes.map((item) => item.portal),
    ...(paginated
      ? []
      : resto.map((numero) => portalVacio(numero, { skipReason: "maxPortals" }))),
  ];

  const inmuebles = lotes.flatMap((item) => item.inmuebles);
  const raw = lotes.find((item) => item.raw)?.raw ?? rawBase;
  const { fincas, prefilter } = await fincasDesdeInmuebles(
    inmuebles,
    portals,
    query,
    client,
    session
  );

  const extras: string[] = [];
  if (limitation) extras.push(limitation);
  if (truncated && !paginated) {
    extras.push(
      `INSPIRE descubrió ${numeros.length} portales oficiales; se procesaron ${aProcesar.length} (maxPortals).`
    );
  }

  const nextOffset = offset + aProcesar.length;
  const nextCursor =
    session && hasNextPage
      ? encodeDiscoveryCursor({ v: 1, id: session.id, offset: nextOffset })
      : null;
  const allProcessed = session
    ? numeros.every((numero) => session.processed.has(numero))
    : !hasNextPage;
  const complete = errorBase == null && !possibleCut && allProcessed;
  const pageBase = session?.pageSize || Math.max(efectivo, 1);

  return resultado({
    query,
    discovery: {
      source: "INSPIRE_AD",
      portalsFound: numeros.length,
      portalsProcessed: aProcesar.length,
      truncated,
      possibleCut,
      complete,
      cobertura: "via-oficial",
      limitation: extras.length > 0 ? extras.join(" ") : null,
      discoveryId: session?.id ?? null,
      page: Math.floor(offset / pageBase) + 1,
      pageSize: efectivo,
      hasNextPage,
      nextCursor,
    },
    portals,
    fincas,
    error: null,
    raw,
    numerosOficiales: numeros,
    prefilter,
  });
}
