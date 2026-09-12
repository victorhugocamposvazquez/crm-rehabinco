/**
 * Catálogo oficial de ubicaciones (provincias, municipios, calles).
 * No clasifica fincas ni toca discovery / DNPLOC / INSPIRE / ltp.
 */
import { getCatastroClient, type CatastroClient } from "./client";
import { CATALOG_CACHE_TTL_MS, CATALOG_MAX_PARAM_LENGTH } from "./constants";
import { CatastroHttpError } from "./http";
import { asArray, asRecord, asString } from "./parse";

export type ProvinciaCatalogo = {
  code: string;
  name: string;
};

export type MunicipioCatalogo = {
  code: string;
  name: string;
};

export type CalleCatalogo = {
  code: string;
  sigla: string;
  name: string;
};

export type CatalogCache = {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  stats(): { hits: number; misses: number };
};

export type CatalogDeps = {
  client?: CatastroClient;
  cache?: CatalogCache;
};

const PARAMS_PROVINCIAS = new Set<string>();
const PARAMS_MUNICIPIOS = new Set(["province", "provincia"]);
const PARAMS_CALLES = new Set(["province", "provincia", "municipality", "municipio"]);

type CacheEntry = { expiresAt: number; payload: unknown };

export function createCatalogCache(ttlMs = CATALOG_CACHE_TTL_MS): CatalogCache {
  const store = new Map<string, CacheEntry>();
  let hits = 0;
  let misses = 0;
  return {
    get<T>(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry || entry.expiresAt <= Date.now()) {
        misses += 1;
        if (entry) store.delete(key);
        return undefined;
      }
      hits += 1;
      return entry.payload as T;
    },
    set(key: string, value: unknown) {
      if (ttlMs <= 0) return;
      store.set(key, { payload: value, expiresAt: Date.now() + ttlMs });
    },
    stats() {
      return { hits, misses };
    },
  };
}

let cacheCompartida: CatalogCache | null = null;

export function getCatalogCache(): CatalogCache {
  cacheCompartida ??= createCatalogCache();
  return cacheCompartida;
}

const inflight = new Map<string, Promise<unknown>>();

function singleFlight<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existente = inflight.get(key);
  if (existente) return existente as Promise<T>;
  const pending = factory().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, pending);
  return pending;
}

export function normalizarNombreCatalogo(valor: string): string {
  return valor.trim().replace(/\s+/g, " ").toUpperCase();
}

export function encontrarPorNombre<T extends { name: string }>(
  items: T[],
  nombre: string
): T | null {
  const objetivo = normalizarNombreCatalogo(nombre);
  if (!objetivo) return null;
  return items.find((item) => normalizarNombreCatalogo(item.name) === objetivo) ?? null;
}

export function validarParametroCatalogo(
  valor: string,
  campo: string
): { ok: true; value: string } | { ok: false; error: string } {
  const recortado = valor.trim();
  if (!recortado) {
    return { ok: false, error: `Falta el parámetro ${campo}.` };
  }
  if (recortado.length > CATALOG_MAX_PARAM_LENGTH) {
    return { ok: false, error: `El parámetro ${campo} supera el límite permitido.` };
  }
  if (/[<>&"'`\\]/.test(recortado) || /[\u0000-\u001f]/.test(recortado)) {
    return { ok: false, error: `El parámetro ${campo} no es válido.` };
  }
  return { ok: true, value: recortado };
}

function clavesQuery(params: URLSearchParams): string[] {
  return [...new Set([...params.keys()].map((key) => key.trim()).filter(Boolean))];
}

function parametrosInesperados(params: URLSearchParams, permitidos: Set<string>): string[] {
  return clavesQuery(params).filter((key) => !permitidos.has(key));
}

function leerAlias(params: URLSearchParams, ...nombres: string[]): string {
  for (const nombre of nombres) {
    const valor = params.get(nombre)?.trim() ?? "";
    if (valor) return valor;
  }
  return "";
}

export function parsearProvincias(raw: unknown): ProvinciaCatalogo[] {
  const root = asRecord(raw);
  const payload = asRecord(root?.consulta_provincieroResult) ?? root;
  const lista = asRecord(payload?.provinciero);
  const vistos = new Set<string>();
  const provincias: ProvinciaCatalogo[] = [];
  for (const item of asArray(lista?.prov)) {
    const record = asRecord(item);
    const code = asString(record?.cpine);
    const name = asString(record?.np);
    if (!code || !name) continue;
    const clave = `${code}|${normalizarNombreCatalogo(name)}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    provincias.push({ code, name });
  }
  return provincias.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function parsearMunicipios(raw: unknown): MunicipioCatalogo[] {
  const root = asRecord(raw);
  const payload = asRecord(root?.consulta_municipieroResult) ?? root;
  const lista = asRecord(payload?.municipiero);
  const vistos = new Set<string>();
  const municipios: MunicipioCatalogo[] = [];
  for (const item of asArray(lista?.muni)) {
    const record = asRecord(item);
    const locat = asRecord(record?.locat);
    const code = asString(locat?.cmc);
    const name = asString(record?.nm);
    if (!code || !name) continue;
    const clave = `${code}|${normalizarNombreCatalogo(name)}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    municipios.push({ code, name });
  }
  return municipios.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function parsearCalles(raw: unknown): CalleCatalogo[] {
  const root = asRecord(raw);
  const payload = asRecord(root?.consulta_callejeroResult) ?? root;
  const lista = asRecord(payload?.callejero);
  const vistos = new Set<string>();
  const calles: CalleCatalogo[] = [];
  for (const item of asArray(lista?.calle)) {
    const dir = asRecord(asRecord(item)?.dir);
    const code = asString(dir?.cv);
    const sigla = asString(dir?.tv);
    const name = asString(dir?.nv);
    if (!code || !sigla || !name) continue;
    const clave = `${code}|${sigla}|${normalizarNombreCatalogo(name)}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    calles.push({ code, sigla, name });
  }
  return calles.sort((a, b) => {
    const porNombre = a.name.localeCompare(b.name, "es");
    if (porNombre !== 0) return porNombre;
    return a.sigla.localeCompare(b.sigla, "es");
  });
}

function jsonLimpio(cuerpo: Record<string, unknown>, status = 200): Response {
  return Response.json(cuerpo, { status });
}

function errorCatalogo(status: number, error: string): Response {
  return jsonLimpio({ ok: false, error }, status);
}

function sinSesion(): Response {
  return errorCatalogo(401, "Sesión expirada");
}

function errorUpstream(error: unknown): Response {
  if (error instanceof CatastroHttpError) {
    return errorCatalogo(502, "Catastro no está disponible en este momento. Inténtalo de nuevo.");
  }
  return errorCatalogo(502, "Catastro no está disponible en este momento. Inténtalo de nuevo.");
}

async function resolverProvincias(
  client: CatastroClient,
  cache: CatalogCache
): Promise<ProvinciaCatalogo[]> {
  const cached = cache.get<ProvinciaCatalogo[]>("provinces");
  if (cached) return cached;
  return singleFlight("provinces", async () => {
    const otra = cache.get<ProvinciaCatalogo[]>("provinces");
    if (otra) return otra;
    const raw = await client.obtenerProvincias();
    const provincias = parsearProvincias(raw);
    cache.set("provinces", provincias);
    return provincias;
  });
}

async function resolverMunicipios(
  provincia: ProvinciaCatalogo,
  client: CatastroClient,
  cache: CatalogCache
): Promise<MunicipioCatalogo[]> {
  const key = `municipalities:${normalizarNombreCatalogo(provincia.name)}`;
  const cached = cache.get<MunicipioCatalogo[]>(key);
  if (cached) return cached;
  return singleFlight(key, async () => {
    const otra = cache.get<MunicipioCatalogo[]>(key);
    if (otra) return otra;
    const raw = await client.obtenerMunicipios(provincia.name);
    const municipios = parsearMunicipios(raw);
    cache.set(key, municipios);
    return municipios;
  });
}

async function resolverCalles(
  provincia: ProvinciaCatalogo,
  municipio: MunicipioCatalogo,
  client: CatastroClient,
  cache: CatalogCache
): Promise<CalleCatalogo[]> {
  const key = `streets:${normalizarNombreCatalogo(provincia.name)}:${normalizarNombreCatalogo(municipio.name)}`;
  const cached = cache.get<CalleCatalogo[]>(key);
  if (cached) return cached;
  return singleFlight(key, async () => {
    const otra = cache.get<CalleCatalogo[]>(key);
    if (otra) return otra;
    const raw = await client.obtenerCallejero({
      provincia: provincia.name,
      municipio: municipio.name,
    });
    const calles = parsearCalles(raw);
    cache.set(key, calles);
    return calles;
  });
}

async function provinciaOficial(
  nombre: string,
  client: CatastroClient,
  cache: CatalogCache
): Promise<ProvinciaCatalogo | null> {
  const provincias = await resolverProvincias(client, cache);
  return encontrarPorNombre(provincias, nombre);
}

export async function responderProvincias(
  request: Request,
  user: { id: string } | null,
  deps: CatalogDeps = {}
): Promise<Response> {
  if (!user) return sinSesion();
  const params = new URL(request.url).searchParams;
  const extra = parametrosInesperados(params, PARAMS_PROVINCIAS);
  if (extra.length > 0) {
    return errorCatalogo(400, "Esta consulta no admite parámetros.");
  }

  const client = deps.client ?? getCatastroClient();
  const cache = deps.cache ?? getCatalogCache();
  try {
    const provinces = await resolverProvincias(client, cache);
    return jsonLimpio({ ok: true, provinces });
  } catch (error) {
    return errorUpstream(error);
  }
}

export async function responderMunicipios(
  request: Request,
  user: { id: string } | null,
  deps: CatalogDeps = {}
): Promise<Response> {
  if (!user) return sinSesion();
  const params = new URL(request.url).searchParams;
  const extra = parametrosInesperados(params, PARAMS_MUNICIPIOS);
  if (extra.length > 0) {
    return errorCatalogo(400, "Esta consulta incluye parámetros no permitidos.");
  }

  const crudo = leerAlias(params, "province", "provincia");
  const validado = validarParametroCatalogo(crudo, "province");
  if (!validado.ok) return errorCatalogo(400, validado.error);

  const client = deps.client ?? getCatastroClient();
  const cache = deps.cache ?? getCatalogCache();
  try {
    const provincia = await provinciaOficial(validado.value, client, cache);
    if (!provincia) {
      return errorCatalogo(400, "La provincia no es una provincia oficial de Catastro.");
    }
    const items = await resolverMunicipios(provincia, client, cache);
    return jsonLimpio({ ok: true, items });
  } catch (error) {
    return errorUpstream(error);
  }
}

export type CallejeroOficial = {
  provincia: ProvinciaCatalogo;
  municipio: MunicipioCatalogo;
  calles: CalleCatalogo[];
};

export type ResultadoCallejeroOficial =
  | { ok: true; callejero: CallejeroOficial }
  | { ok: false; code: "invalid" | "upstream"; error: string };

/**
 * Callejero oficial de un municipio (misma fuente y misma cache que `/api/catastro/streets`).
 * Lo usa el endpoint y también la búsqueda por zona; aquí no hay HTTP.
 */
export async function obtenerCallejeroOficial(
  provinciaRaw: string,
  municipioRaw: string,
  deps: CatalogDeps = {}
): Promise<ResultadoCallejeroOficial> {
  const provinciaOk = validarParametroCatalogo(provinciaRaw, "province");
  if (!provinciaOk.ok) return { ok: false, code: "invalid", error: provinciaOk.error };
  const municipioOk = validarParametroCatalogo(municipioRaw, "municipality");
  if (!municipioOk.ok) return { ok: false, code: "invalid", error: municipioOk.error };

  const client = deps.client ?? getCatastroClient();
  const cache = deps.cache ?? getCatalogCache();
  try {
    const provincia = await provinciaOficial(provinciaOk.value, client, cache);
    if (!provincia) {
      return {
        ok: false,
        code: "invalid",
        error: "La provincia no es una provincia oficial de Catastro.",
      };
    }
    const municipios = await resolverMunicipios(provincia, client, cache);
    const municipio = encontrarPorNombre(municipios, municipioOk.value);
    if (!municipio) {
      return {
        ok: false,
        code: "invalid",
        error: "El municipio no es un municipio oficial de esa provincia.",
      };
    }
    const calles = await resolverCalles(provincia, municipio, client, cache);
    return { ok: true, callejero: { provincia, municipio, calles } };
  } catch {
    return {
      ok: false,
      code: "upstream",
      error: "Catastro no está disponible en este momento. Inténtalo de nuevo.",
    };
  }
}

export async function responderCalles(
  request: Request,
  user: { id: string } | null,
  deps: CatalogDeps = {}
): Promise<Response> {
  if (!user) return sinSesion();
  const params = new URL(request.url).searchParams;
  const extra = parametrosInesperados(params, PARAMS_CALLES);
  if (extra.length > 0) {
    return errorCatalogo(400, "Esta consulta incluye parámetros no permitidos.");
  }

  const resultado = await obtenerCallejeroOficial(
    leerAlias(params, "province", "provincia"),
    leerAlias(params, "municipality", "municipio"),
    deps
  );
  if (!resultado.ok) {
    return errorCatalogo(resultado.code === "invalid" ? 400 : 502, resultado.error);
  }
  return jsonLimpio({ ok: true, items: resultado.callejero.calles });
}
