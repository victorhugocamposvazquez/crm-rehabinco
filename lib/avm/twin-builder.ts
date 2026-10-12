import type { SupabaseClient } from "@supabase/supabase-js";
import { createCatastroClient } from "../catastro/client";
import { TIPOS_VIA_OFICIALES } from "../catastro/constants";
import { asArray, asRecord, asString } from "../catastro/parse";
import type { ResultadoConsultaCatastro } from "../catastro/types";
import { createAdminClient } from "../supabase/admin";
import { emptyTwin, type MainType, type PropertyType, type Twin } from "./types";

const TOPE_MS = 3000;
const TTL_CATASTRO_MS = 90 * 24 * 60 * 60 * 1000;
const GANA_CATASTRO = new Set<keyof Twin>([
  "builtSurface",
  "constructionYear",
  "floorOfFlat",
  "numberOfFloors",
  "landSurface",
]);

export type FieldSource = "catastro_local" | "catastro_sede" | "listing" | "crm";
export type PropertySource = FieldSource | "manual";
export type GeocodingSource = "google" | "cartociudad" | "postcode_centroid" | "pin" | "listing" | "catastro" | "missing";

export type TwinUnit = {
  catastralRef: string;
  floor: string | null;
  door: string | null;
  surface: number | null;
  use: string | null;
  isDwelling: boolean;
};

export type TwinBuild = {
  twin: Twin;
  prefilledFields: Set<keyof Twin>;
  fieldSources: Partial<Record<keyof Twin, FieldSource>>;
  propertySource: PropertySource;
  geocodingSource: GeocodingSource;
  zone: { censusSection: string | null; municipalityCode: string | null; postcode: string | null };
  units?: TwinUnit[];
  listingPrice?: number;
  warnings: string[];
};

export type TwinInput = {
  address?: string;
  lat?: number;
  lng?: number;
  catastralRef?: string;
  listingId?: string;
  crmPropertyId?: string;
};

export type TwinCtx = { tenantId: string; db?: SupabaseClient };

export type GeoHit = {
  lat: number;
  lng: number;
  formattedAddress?: string | null;
  route?: string | null;
  streetNumber?: string | null;
  postcode?: string | null;
  locality?: string | null;
  province?: string | null;
  tipVia?: string | null;
  googlePlaceId?: string | null;
  refCatastral?: string | null;
};

export type ViaCatastro = {
  provincia: string;
  municipio: string;
  sigla: string;
  calle: string;
  numero: string;
};

export type CatastroHit = {
  parcelRef: string | null;
  units: TwinUnit[];
  builtSurface: number | null;
  landSurface: number | null;
  constructionYear: number | null;
  floorOfFlat: number | null;
  numberOfFloors: number | null;
  centroid?: { lat: number; lng: number } | null;
  unitRef?: string | null;
  mainType: MainType | null;
  propertyType: PropertyType | null;
};

export type FichaOrigen = {
  source: "listing" | "crm";
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  postcode?: string | null;
  builtSurface?: number | null;
  rooms?: number | null;
  bathrooms?: number | null;
  floor?: number | null;
  hasElevator?: boolean | null;
  isExterior?: boolean | null;
  hasGarage?: boolean | null;
  hasTerrace?: boolean | null;
  conditionHint?: string | null;
  price?: number | null;
  mainType?: MainType | null;
  propertyType?: PropertyType | null;
  constructionYear?: number | null;
};

type SedeResult = { hit: CatastroHit | null; warning?: string };

export type TwinDeps = {
  geocodeGoogle: (address: string) => Promise<GeoHit | null>;
  geocodeCartociudad: (address: string) => Promise<GeoHit | null>;
  postcodeCentroid: (postcode: string) => Promise<GeoHit | null>;
  postcodeAt: (lat: number, lng: number) => Promise<string | null>;
  zoneAt: (lat: number, lng: number) => Promise<{ censusSection: string | null; municipalityCode: string | null }>;
  catastroLocal: (q: { ref?: string; lat?: number; lng?: number }) => Promise<CatastroHit | null>;
  catastroSede: (q: { ref?: string; address?: string; via?: ViaCatastro; lat?: number; lng?: number }) => Promise<SedeResult>;
  listingById: (id: string) => Promise<FichaOrigen | null>;
  crmById: (id: string, tenantId: string) => Promise<FichaOrigen | null>;
};

export function condicionDesdePista(pista: string | null | undefined): 1 | 2 | 3 | 4 | 5 | null {
  if (!pista?.trim()) return null;
  const t = pista.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  if (t.includes("estren") || t.includes("obra nueva") || t.includes("nuevo")) return 5;
  if (t.includes("reformado")) return 4;
  if (t.includes("buen estado")) return 3;
  if (t.includes("actualizar")) return 2;
  if (t.includes("reformar")) return 1;
  return null;
}

export function plantaNumero(planta: string | null | undefined): number | null {
  if (!planta?.trim()) return null;
  const t = planta.trim().toUpperCase();
  if (t === "+1" || t === "-1") return null;
  if (/^-?\d+$/.test(t)) return Number(t);
  if (t === "BJ" || t === "BA" || t === "OD" || t === "EN") return 0;
  if (t === "SS" || t === "SM") return -1;
  return null;
}

export function esVivienda(uso: string | null | undefined): boolean {
  if (!uso) return false;
  const t = uso.toLowerCase();
  if (/almac|estacionamiento|garaje|aparcamiento|trastero|comercial|oficina|industrial|suelo|solar/.test(t)) return false;
  return /vivienda|residencial/.test(t);
}

function tipoDesdeUso(uso: string | null, viviendas: number): { mainType: MainType; propertyType: PropertyType } | null {
  const t = (uso ?? "").toLowerCase();
  if (/suelo|solar|sin edificar/.test(t)) return { mainType: "land", propertyType: "land" };
  if (/unifamiliar|casa|chalet/.test(t)) return { mainType: "house", propertyType: "house" };
  if (/vivienda|residencial/.test(t)) {
    return viviendas > 1
      ? { mainType: "apartment", propertyType: "apartment" }
      : { mainType: "house", propertyType: "house" };
  }
  return null;
}

function ordenarUnidades(units: TwinUnit[]): TwinUnit[] {
  return [...units].sort((a, b) => {
    if (a.isDwelling !== b.isDwelling) return a.isDwelling ? -1 : 1;
    const fa = plantaNumero(a.floor);
    const fb = plantaNumero(b.floor);
    const na = fa ?? 999;
    const nb = fb ?? 999;
    if (na !== nb) return na - nb;
    return (a.door ?? "").localeCompare(b.door ?? "", "es");
  });
}

export async function conCache<T>(opts: {
  ttlMs: number;
  now: number;
  read: () => Promise<{ payload: T; fetchedAt: string } | null>;
  write: (payload: T) => Promise<void>;
  fetchFresh: () => Promise<T | null>;
}): Promise<{ value: T | null; stale: boolean; warning: string | null }> {
  try {
    const fresh = await opts.fetchFresh();
    if (fresh != null) {
      try {
        await opts.write(fresh);
      } catch {
        /* un fallo al guardar la caché no tira el dato fresco */
      }
      return { value: fresh, stale: false, warning: null };
    }
  } catch {
    const cached = await opts.read().catch(() => null);
    if (cached) {
      return {
        value: cached.payload,
        stale: true,
        warning: `La Sede del Catastro no respondió; se usan datos en caché del ${cached.fetchedAt}.`,
      };
    }
    return { value: null, stale: false, warning: "La Sede del Catastro no respondió y no hay caché." };
  }
  const cached = await opts.read().catch(() => null);
  if (!cached) return { value: null, stale: false, warning: null };
  const edad = opts.now - new Date(cached.fetchedAt).getTime();
  if (edad <= opts.ttlMs) return { value: cached.payload, stale: false, warning: null };
  return {
    value: cached.payload,
    stale: true,
    warning: `La Sede del Catastro no respondió; se usan datos en caché del ${cached.fetchedAt}.`,
  };
}

function aviso(err: unknown): string {
  return err instanceof Error ? err.message : "Fallo inesperado";
}

function codigoPostal(texto: string | null | undefined): string | null {
  return texto?.match(/\b(\d{5})\b/)?.[1] ?? null;
}

function normalizarConsulta(address: string): string {
  return address
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\b\d{5}\b/g, " ")
    .replace(/\b(rua|ruela)\b/gi, "Calle")
    .replace(/[,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numeroPortal(address: string): string | null {
  const sinCp = address.replace(/\b\d{5}\b/g, " ");
  return sinCp.match(/\b(\d+)\b/)?.[1] ?? null;
}

function calleCartociudad(item: Record<string, unknown>): string | null {
  if (typeof item.address !== "string") return null;
  let calle = item.address.split(",")[0].trim();
  const tip = typeof item.tip_via === "string" ? item.tip_via : "";
  if (tip && calle.toUpperCase().startsWith(`${tip.toUpperCase()} `)) calle = calle.slice(tip.length).trim();
  const numero = item.portalNumber == null ? "" : String(item.portalNumber);
  if (numero && calle.endsWith(` ${numero}`)) calle = calle.slice(0, -(numero.length + 1)).trim();
  return calle || null;
}

async function pedirCartociudad(path: "candidates" | "find", q: string): Promise<GeoHit | null> {
  const url = new URL(`https://www.cartociudad.es/geocoder/api/geocoder/${path}`);
  url.searchParams.set("q", q);
  if (path === "candidates") url.searchParams.set("limit", "1");
  const res = await fetch(url, { signal: AbortSignal.timeout(TOPE_MS) });
  if (res.status === 204 || !res.ok) return null;
  const json = (await res.json()) as unknown;
  const item = (Array.isArray(json) ? json[0] : json) as Record<string, unknown> | null;
  if (!item || typeof item.lat !== "number" || typeof item.lng !== "number") return null;
  return {
    lat: item.lat,
    lng: item.lng,
    formattedAddress: typeof item.address === "string" ? item.address : null,
    route: calleCartociudad(item),
    tipVia: typeof item.tip_via === "string" ? item.tip_via : null,
    streetNumber: item.portalNumber == null ? null : String(item.portalNumber),
    postcode: typeof item.postalCode === "string" ? item.postalCode : null,
    locality: typeof item.muni === "string" ? item.muni : typeof item.poblacion === "string" ? item.poblacion : null,
    province: typeof item.province === "string" ? item.province : null,
    refCatastral: typeof item.refCatastral === "string" ? item.refCatastral : null,
  };
}

async function geocodeGoogle(address: string): Promise<GeoHit | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY;
  if (!key) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("region", "es");
  url.searchParams.set("key", key);
  const res = await fetch(url, { signal: AbortSignal.timeout(TOPE_MS) });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    results?: Array<{
      formatted_address?: string;
      place_id?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      address_components?: Array<{ long_name: string; types: string[] }>;
    }>;
  };
  const first = json.results?.[0];
  const loc = first?.geometry?.location;
  if (!first || typeof loc?.lat !== "number" || typeof loc.lng !== "number") return null;
  const comp = (tipo: string) => first.address_components?.find((c) => c.types.includes(tipo))?.long_name ?? null;
  return {
    lat: loc.lat,
    lng: loc.lng,
    formattedAddress: first.formatted_address ?? null,
    route: comp("route"),
    streetNumber: comp("street_number"),
    postcode: comp("postal_code"),
    locality: comp("locality"),
    province: comp("administrative_area_level_2"),
    googlePlaceId: first.place_id ?? null,
  };
}

async function geocodeCartociudad(address: string): Promise<GeoHit | null> {
  const q = normalizarConsulta(address);
  const numero = numeroPortal(address);
  const candidato = await pedirCartociudad("candidates", q);
  if (candidato && (!numero || candidato.streetNumber === numero)) return candidato;
  const encontrado = await pedirCartociudad("find", q);
  if (encontrado && (!numero || encontrado.streetNumber === numero)) return encontrado;
  return encontrado ?? candidato;
}

function adminONull(): SupabaseClient | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

function usoATipo(uso: string): { mainType: MainType; propertyType: PropertyType } | null {
  const t = uso.toLowerCase();
  if (/comercial|industrial|oficina/.test(t)) return null;
  if (/unifamiliar|casa|chalet/.test(t)) return { mainType: "house", propertyType: "house" };
  if (/vivienda|residencial/.test(t)) return { mainType: "apartment", propertyType: "apartment" };
  if (/suelo|solar/.test(t)) return { mainType: "land", propertyType: "land" };
  return null;
}

function moda(nums: number[]): number | null {
  if (!nums.length) return null;
  const cuentas = new Map<number, number>();
  for (const n of nums) cuentas.set(n, (cuentas.get(n) ?? 0) + 1);
  let mejor = nums[0];
  let max = 0;
  for (const [n, c] of cuentas) {
    if (c > max) {
      max = c;
      mejor = n;
    }
  }
  return mejor;
}

export function hitDesdeConsulta(resultado: ResultadoConsultaCatastro, elegidaRef?: string | null): CatastroHit | null {
  if (resultado.tipo === "error" || resultado.tipo === "vacio" || resultado.results.length === 0) return null;
  const units = ordenarUnidades(
    resultado.results.flatMap((item) => {
      const ref = item.referenciaCatastral?.replace(/\s/g, "") ?? "";
      if (ref.length !== 20) return [];
      const use = item.uso ?? null;
      return [{
        catastralRef: ref,
        floor: item.direccion.planta,
        door: item.direccion.puerta,
        surface: item.superficie,
        use,
        isDwelling: esVivienda(use),
      }];
    })
  );
  const pedida = elegidaRef?.replace(/\s/g, "") ?? "";
  const elegida = pedida.length === 20 ? units.find((u) => u.catastralRef === pedida) ?? null : units.length === 1 ? units[0] : null;
  const viviendas = units.filter((u) => u.isDwelling).length;
  const years = resultado.results.map((r) => r.anio).filter((n): n is number => n != null);
  const plantas = units.map((u) => plantaNumero(u.floor)).filter((n): n is number => n != null && n >= 0);
  const land = resultado.results.map((r) => r.finca?.superficieSolar).find((n) => n != null) ?? null;
  const sinEdificar = units.length === 0;
  const tipo = elegida
    ? tipoDesdeUso(elegida.use, viviendas)
    : sinEdificar
      ? { mainType: "land" as const, propertyType: "land" as const }
      : units.length > 1
        ? { mainType: "building" as const, propertyType: "building" as const }
        : null;
  return {
    parcelRef: resultado.results[0]?.referenciaParcela ?? (pedida.length >= 14 ? pedida.slice(0, 14) : null),
    unitRef: elegida?.catastralRef ?? null,
    units: elegida || units.length <= 1 ? [] : units,
    builtSurface: elegida?.surface ?? null,
    landSurface: land ?? null,
    constructionYear: moda(years),
    floorOfFlat: elegida ? plantaNumero(elegida.floor) : null,
    numberOfFloors: plantas.length ? Math.max(...plantas) : null,
    mainType: tipo?.mainType ?? null,
    propertyType: tipo?.propertyType ?? null,
  };
}

function referenciaDesdeRccoor(raw: unknown): string | null {
  const root = asRecord(raw);
  const result = asRecord(root?.Consulta_RCCOORResult) ?? asRecord(root?.consulta_coordenadasResult) ?? root;
  const coordenadas = asRecord(result?.coordenadas);
  const lista = asArray(coordenadas?.coord);
  const coord = asRecord(lista[0]) ?? asRecord(coordenadas?.coord);
  const pc = asRecord(coord?.pc);
  const pc1 = asString(pc?.pc1);
  const pc2 = asString(pc?.pc2);
  if (!pc1 || !pc2) return null;
  return `${pc1}${pc2}`;
}

function viaDesde(geo: GeoHit | null, direccion: string | null): ViaCatastro | null {
  if (geo?.route && geo.streetNumber) {
    return {
      provincia: (geo.province ?? "A CORUÑA").toUpperCase(),
      municipio: (geo.locality ?? "A CORUÑA").toUpperCase(),
      sigla: geo.tipVia ?? "CALLE",
      calle: geo.route.toUpperCase(),
      numero: geo.streetNumber,
    };
  }
  if (!direccion) return null;
  const dir = partirDireccion(direccion);
  if (!dir.calle || !dir.numero) return null;
  return dir;
}

function partirDireccion(address: string): { provincia: string; municipio: string; calle: string; numero: string; sigla: string } {
  const sinCp = address.replace(/\b\d{5}\b/g, " ").replace(/\s+/g, " ").trim();
  const partes = sinCp.split(",").map((p) => p.trim()).filter(Boolean);
  const cabeza = partes[0] ?? sinCp;
  const numero = cabeza.match(/(\d+)\s*$/)?.[1] ?? "";
  let calle = cabeza.replace(/\s*\d+\s*$/, "").trim();
  let sigla = "CL";
  const via = calle.match(/^(rúa|rua|calle|avenida|avda\.?|plaza|praza|camino)\s+/i);
  if (via) {
    const nombre = via[1].toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    if (nombre.startsWith("av")) sigla = "AV";
    else if (nombre.startsWith("pl") || nombre.startsWith("pr")) sigla = "PZ";
    else if (nombre.startsWith("cam")) sigla = "CM";
    calle = calle.slice(via[0].length).trim();
  }
  const resto = partes.slice(1).join(" ").trim();
  const municipio = resto || "A Coruña";
  const provincia = /coru/i.test(address) ? "A CORUÑA" : municipio;
  return { provincia, municipio, calle, numero, sigla };
}

function hitLocal(row: {
  parcel_ref: string;
  year_built: number | null;
  floors_above_ground: number | null;
  area_m2: number | null;
  dwellings: number | null;
  current_use: string | null;
}): CatastroHit {
  const varias = (row.dwellings ?? 0) > 1;
  const tipo = row.current_use ? usoATipo(row.current_use) : null;
  return {
    parcelRef: row.parcel_ref,
    units: [],
    builtSurface: varias ? null : row.area_m2,
    landSurface: null,
    constructionYear: row.year_built,
    floorOfFlat: null,
    numberOfFloors: row.floors_above_ground,
    mainType: tipo?.mainType ?? (row.current_use === "residential" ? "apartment" : null),
    propertyType: tipo?.propertyType ?? (row.current_use === "residential" ? "apartment" : null),
  };
}

function depsReales(ctx: TwinCtx): TwinDeps {
  return {
    geocodeGoogle,
    geocodeCartociudad,
    async postcodeCentroid(postcode) {
      const db = adminONull();
      if (db) {
        const { data } = await db.from("postcode_centroids").select("lat, lng").eq("postcode", postcode).maybeSingle();
        if (data && data.lat != null && data.lng != null) {
          return { lat: Number(data.lat), lng: Number(data.lng), postcode };
        }
      }
      const hit = await pedirCartociudad("find", postcode);
      if (hit && db) {
        await db.from("postcode_centroids").upsert({ postcode, lat: hit.lat, lng: hit.lng, source: "cartociudad" });
      }
      return hit ? { ...hit, postcode: hit.postcode ?? postcode } : null;
    },
    async postcodeAt(lat, lng) {
      const db = adminONull();
      if (db) {
        const { data } = await db.rpc("avm_postcode_at", { p_lat: lat, p_lng: lng });
        const cp = typeof data === "string" ? data : null;
        if (cp) return cp;
      }
      const url = new URL("https://www.cartociudad.es/geocoder/api/geocoder/reverseGeocode");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      const res = await fetch(url, { signal: AbortSignal.timeout(TOPE_MS) });
      if (!res.ok) return null;
      const json = (await res.json()) as { postalCode?: string };
      const cp = typeof json.postalCode === "string" && /^\d{5}$/.test(json.postalCode) ? json.postalCode : null;
      if (cp && db) {
        await db.from("postcode_reverse_cache").upsert({
          lat: Number(lat.toFixed(5)),
          lng: Number(lng.toFixed(5)),
          postcode: cp,
        });
      }
      return cp;
    },
    async zoneAt(lat, lng) {
      const db = adminONull();
      if (!db) return { censusSection: null, municipalityCode: null };
      const { data, error } = await db.rpc("avm_point_zone", { p_lat: lat, p_lng: lng });
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      return {
        censusSection: row?.census_section ?? null,
        municipalityCode: row?.municipality_code ?? null,
      };
    },
    async catastroLocal(q) {
      const db = adminONull();
      if (!db) return null;
      if (q.ref) {
        const parcela = q.ref.replace(/\s/g, "").slice(0, 14);
        const { data } = await db
          .from("catastro_buildings")
          .select("parcel_ref, year_built, floors_above_ground, area_m2, dwellings, current_use")
          .eq("parcel_ref", parcela)
          .limit(1);
        if (data?.[0]) return hitLocal(data[0]);
      }
      if (q.lat == null || q.lng == null) return null;
      const { data } = await db.rpc("avm_catastro_local_at", { p_lat: q.lat, p_lng: q.lng });
      const row = Array.isArray(data) ? data[0] : data;
      return row?.parcel_ref ? hitLocal(row) : null;
    },
    async catastroSede(q) {
      const key = q.ref
        ? `v2:ref:${q.ref.replace(/\s/g, "")}`
        : q.via
          ? `v2:via:${q.via.sigla}|${q.via.calle}|${q.via.numero}|${q.via.municipio}`
          : q.address
            ? `v2:addr:${q.address.trim().toLowerCase()}`
            : q.lat != null && q.lng != null
              ? `v2:xy:${q.lat.toFixed(5)},${q.lng.toFixed(5)}`
              : "";
      if (!key) return { hit: null };
      const db = adminONull();
      const leido = await conCache<CatastroHit>({
        ttlMs: TTL_CATASTRO_MS,
        now: Date.now(),
        read: async () => {
          if (!db) return null;
          const { data } = await db.from("catastro_cache").select("payload, fetched_at").eq("key", key).maybeSingle();
          if (!data?.payload) return null;
          return { payload: data.payload as CatastroHit, fetchedAt: String(data.fetched_at) };
        },
        write: async (payload) => {
          if (!db) return;
          const { error } = await db.from("catastro_cache").upsert({ key, payload, fetched_at: new Date().toISOString() });
          if (error) throw new Error(error.message);
        },
        fetchFresh: () => pedirSede(q),
      });
      return { hit: leido.value, warning: leido.warning ?? undefined };
    },
    async listingById(id) {
      const db = adminONull();
      if (!db) return null;
      const market = await db.from("market_listings").select("*").eq("id", id).maybeSingle();
      if (market.data) return fichaMercado(market.data);
      if (!ctx.db) return null;
      const cap = await ctx.db.from("captacion_anuncios").select("*").eq("id", id).maybeSingle();
      if (cap.error || !cap.data) return null;
      return fichaCaptacion(cap.data);
    },
    async crmById(id) {
      if (!ctx.db) return null;
      const { data, error } = await ctx.db
        .from("inmuebles")
        .select("direccion, codigo_postal, superficie_m2, habitaciones, banos, planta, ascensor, anio_construccion, tipo_inmueble, precio_venta, precio_alquiler")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return {
        source: "crm",
        address: data.direccion,
        postcode: data.codigo_postal,
        builtSurface: data.superficie_m2 == null ? null : Number(data.superficie_m2),
        rooms: data.habitaciones,
        bathrooms: data.banos,
        floor: data.planta == null ? null : Number(data.planta),
        hasElevator: data.ascensor,
        constructionYear: data.anio_construccion,
        mainType: tipoInmueble(data.tipo_inmueble),
        propertyType: tipoInmueble(data.tipo_inmueble) === "house" ? "house" : tipoInmueble(data.tipo_inmueble) === "apartment" ? "apartment" : null,
      };
    },
  };
}

function siglaOficial(tipVia: string | null | undefined): string {
  const t = (tipVia ?? "CALLE").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
  const porCodigo = TIPOS_VIA_OFICIALES.find((item) => item.codigo === t);
  if (porCodigo) return porCodigo.codigo;
  const porNombre = TIPOS_VIA_OFICIALES.find((item) => item.nombres.some((nombre) => nombre === t));
  return porNombre?.codigo ?? "CL";
}

function centroideDesdeCpmrc(raw: unknown): { lat: number; lng: number } | null {
  const root = asRecord(raw);
  const result = asRecord(root?.Consulta_CPMRCResult);
  const coordenadas = asRecord(result?.coordenadas);
  const lista = asArray(coordenadas?.coord);
  const coord = asRecord(lista[0]) ?? asRecord(coordenadas?.coord);
  const geo = asRecord(coord?.geo);
  const lng = Number(asString(geo?.xcen));
  const lat = Number(asString(geo?.ycen));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function conCentroide(client: ReturnType<typeof createCatastroClient>, hit: CatastroHit | null): Promise<CatastroHit | null> {
  if (!hit?.parcelRef || hit.parcelRef.length < 14) return hit;
  try {
    const crudo = await client.consultarCoordenadasPorReferencia(hit.parcelRef.slice(0, 14));
    const centroid = centroideDesdeCpmrc(crudo);
    return centroid ? { ...hit, centroid } : hit;
  } catch {
    return hit;
  }
}

async function pedirSede(q: { ref?: string; address?: string; via?: ViaCatastro; lat?: number; lng?: number }): Promise<CatastroHit | null> {
  const client = createCatastroClient({ timeoutMs: TOPE_MS, minIntervalMs: 0 });
  const ref = q.ref?.replace(/\s/g, "");
  if (ref && ref.length >= 20) {
    const parcela = await client.consultarReferencia({ refCat: ref.slice(0, 14) });
    const hit = hitDesdeConsulta(parcela, ref);
    return conCentroide(client, hit);
  }
  if (ref) {
    const raw = await client.consultarReferencia({ refCat: ref.slice(0, 14) });
    return conCentroide(client, hitDesdeConsulta(raw));
  }
  if (q.via?.calle && q.via.numero) {
    const raw = await client.consultarDireccion({
      provincia: q.via.provincia,
      municipio: q.via.municipio,
      sigla: siglaOficial(q.via.sigla),
      calle: q.via.calle,
      numero: q.via.numero,
    });
    return conCentroide(client, hitDesdeConsulta(raw));
  }
  if (q.address) {
    const dir = partirDireccion(q.address);
    if (!dir.calle || !dir.numero) return null;
    const raw = await client.consultarDireccion(dir);
    return conCentroide(client, hitDesdeConsulta(raw));
  }
  if (q.lat == null || q.lng == null) return null;
  const crudo = await client.consultarReferenciaPorCoordenadas(q.lat, q.lng);
  const porPunto = referenciaDesdeRccoor(crudo);
  if (!porPunto) return null;
  const detalle = await client.consultarReferencia({ refCat: porPunto });
  return conCentroide(client, hitDesdeConsulta(detalle));
}

function fichaMercado(row: Record<string, unknown>): FichaOrigen {
  return {
    source: "listing",
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    postcode: row.postcode == null ? null : String(row.postcode),
    builtSurface: row.surface == null ? null : Number(row.surface),
    rooms: row.rooms == null ? null : Number(row.rooms),
    bathrooms: row.bathrooms == null ? null : Number(row.bathrooms),
    floor: row.floor == null ? null : Number(row.floor),
    hasElevator: row.has_elevator == null ? null : Boolean(row.has_elevator),
    isExterior: row.is_exterior == null ? null : Boolean(row.is_exterior),
    hasGarage: row.has_garage == null ? null : Boolean(row.has_garage),
    hasTerrace: row.has_terrace == null ? null : Boolean(row.has_terrace),
    conditionHint: row.condition_hint == null ? null : String(row.condition_hint),
    price: row.price == null ? null : Number(row.price),
    mainType: row.main_type === "house" || row.main_type === "apartment" || row.main_type === "land" || row.main_type === "building" ? row.main_type : null,
    propertyType: row.main_type === "house" ? "house" : row.main_type === "apartment" ? "apartment" : null,
  };
}

function fichaCaptacion(row: Record<string, unknown>): FichaOrigen {
  return {
    source: "listing",
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    address: row.direccion == null ? null : String(row.direccion),
    postcode: row.codigo_postal == null ? null : String(row.codigo_postal),
    builtSurface: row.superficie == null ? null : Number(row.superficie),
    rooms: row.habitaciones == null ? null : Number(row.habitaciones),
    bathrooms: row.banos == null ? null : Number(row.banos),
    floor: plantaNumero(row.planta == null ? null : String(row.planta)),
    price: row.precio == null ? null : Number(row.precio),
    mainType: tipoInmueble(row.tipo == null ? null : String(row.tipo)),
  };
}

function tipoInmueble(tipo: string | null): MainType | null {
  if (!tipo) return null;
  const t = tipo.toLowerCase();
  if (/casa|chalet|unifamiliar/.test(t)) return "house";
  if (/piso|apartamento|atico|ático|duplex|dúplex|estudio/.test(t)) return "apartment";
  if (/terreno|suelo|solar/.test(t)) return "land";
  if (/edificio|local|nave/.test(t)) return "building";
  return null;
}

function poner(
  twin: Twin,
  sources: Partial<Record<keyof Twin, FieldSource>>,
  key: keyof Twin,
  value: Twin[keyof Twin],
  source: FieldSource
): void {
  if (value == null) return;
  const actual = sources[key];
  if (actual === "catastro_local" && source === "catastro_sede") return;
  if (actual && GANA_CATASTRO.has(key) && (actual === "catastro_local" || actual === "catastro_sede") && (source === "listing" || source === "crm")) {
    return;
  }
  (twin as unknown as Record<string, unknown>)[key] = value;
  sources[key] = source;
}

function aplicarCatastro(twin: Twin, sources: Partial<Record<keyof Twin, FieldSource>>, hit: CatastroHit, source: FieldSource): void {
  poner(twin, sources, "constructionYear", hit.constructionYear, source);
  poner(twin, sources, "numberOfFloors", hit.numberOfFloors, source);
  poner(twin, sources, "landSurface", hit.landSurface, source);
  if (hit.units.length <= 1) {
    poner(twin, sources, "builtSurface", hit.builtSurface, source);
    poner(twin, sources, "floorOfFlat", hit.floorOfFlat, source);
  }
  poner(twin, sources, "mainType", hit.mainType, source);
  poner(twin, sources, "propertyType", hit.propertyType, source);
}

function aplicarFicha(twin: Twin, sources: Partial<Record<keyof Twin, FieldSource>>, ficha: FichaOrigen): void {
  const source = ficha.source;
  poner(twin, sources, "builtSurface", ficha.builtSurface ?? null, source);
  poner(twin, sources, "floorOfFlat", ficha.floor ?? null, source);
  poner(twin, sources, "hasElevator", ficha.hasElevator ?? null, source);
  if (ficha.isExterior === true) poner(twin, sources, "side", "exterior", source);
  if (ficha.isExterior === false) poner(twin, sources, "side", "interior", source);
  poner(twin, sources, "numberOfBedrooms", ficha.rooms ?? null, source);
  poner(twin, sources, "numberOfBathrooms", ficha.bathrooms ?? null, source);
  if (ficha.hasGarage === true) poner(twin, sources, "numberOfIndoorParkings", 1, source);
  if (ficha.hasGarage === false) poner(twin, sources, "numberOfIndoorParkings", 0, source);
  if (ficha.hasTerrace === true) poner(twin, sources, "hasBalcony", true, source);
  if (ficha.hasTerrace === false) poner(twin, sources, "hasBalcony", false, source);
  poner(twin, sources, "buildingCondition", condicionDesdePista(ficha.conditionHint), source);
  poner(twin, sources, "mainType", ficha.mainType ?? null, source);
  poner(twin, sources, "propertyType", ficha.propertyType ?? null, source);
  poner(twin, sources, "constructionYear", ficha.constructionYear ?? null, source);
}

function fuenteGanadora(sources: Partial<Record<keyof Twin, FieldSource>>): PropertySource {
  const orden: FieldSource[] = ["catastro_local", "catastro_sede", "listing", "crm"];
  let mejor: PropertySource = "manual";
  let max = 0;
  for (const fuente of orden) {
    const n = Object.values(sources).filter((s) => s === fuente).length;
    if (n > max) {
      max = n;
      mejor = fuente;
    }
  }
  return mejor;
}

function manual(input: TwinInput, warnings: string[]): TwinBuild {
  const twin = emptyTwin();
  twin.address.formattedAddress = input.address ?? null;
  twin.address.postcode = codigoPostal(input.address);
  if (input.catastralRef) twin.address.catastralRef = input.catastralRef;
  return {
    twin,
    prefilledFields: new Set(),
    fieldSources: {},
    propertySource: "manual",
    geocodingSource: "missing",
    zone: { censusSection: null, municipalityCode: null, postcode: twin.address.postcode },
    warnings,
  };
}

async function ejecutar(input: TwinInput, ctx: TwinCtx, deps: TwinDeps): Promise<TwinBuild> {
  const warnings: string[] = [];
  const twin = emptyTwin();
  const sources: Partial<Record<keyof Twin, FieldSource>> = {};
  twin.address.formattedAddress = input.address ?? null;
  twin.address.postcode = codigoPostal(input.address);
  if (input.catastralRef) twin.address.catastralRef = input.catastralRef.replace(/\s/g, "");

  let ficha: FichaOrigen | null = null;
  if (input.listingId) {
    try {
      ficha = await deps.listingById(input.listingId);
      if (!ficha) warnings.push("No se ha encontrado el anuncio.");
    } catch (err) {
      warnings.push(`Anuncio: ${aviso(err)}`);
    }
  } else if (input.crmPropertyId) {
    try {
      ficha = await deps.crmById(input.crmPropertyId, ctx.tenantId);
      if (!ficha && !ctx.db) warnings.push("Sin sesión de usuario no se lee el inmueble del CRM.");
      else if (!ficha) warnings.push("No se ha encontrado el inmueble del CRM.");
    } catch (err) {
      warnings.push(`CRM: ${aviso(err)}`);
    }
  }

  let lat = input.lat ?? null;
  let lng = input.lng ?? null;
  let geo: GeoHit | null = null;
  let geocodingSource: GeocodingSource = "missing";
  const direccion = input.address || ficha?.address || null;
  if (!direccion && !twin.address.formattedAddress && ficha?.address) twin.address.formattedAddress = ficha.address;

  if (lat != null && lng != null) {
    geocodingSource = input.listingId || ficha?.source === "listing" ? "listing" : "pin";
  } else if (ficha?.lat != null && ficha.lng != null) {
    lat = ficha.lat;
    lng = ficha.lng;
    geocodingSource = "listing";
  } else if (direccion) {
    try {
      geo = await deps.geocodeCartociudad(direccion);
      if (geo) geocodingSource = "cartociudad";
    } catch (err) {
      warnings.push(`CartoCiudad: ${aviso(err)}`);
    }
    if (!geo) {
      try {
        geo = await deps.geocodeGoogle(direccion);
        if (geo) geocodingSource = "google";
      } catch (err) {
        warnings.push(`Google: ${aviso(err)}`);
      }
    }
    if (!geo) {
      const cp = codigoPostal(direccion) ?? ficha?.postcode ?? null;
      if (cp) {
        try {
          geo = await deps.postcodeCentroid(cp);
          if (geo) geocodingSource = "postcode_centroid";
        } catch (err) {
          warnings.push(`Código postal: ${aviso(err)}`);
        }
      }
    }
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      twin.address.formattedAddress = twin.address.formattedAddress ?? geo.formattedAddress ?? direccion;
      twin.address.route = geo.route ?? null;
      twin.address.streetNumber = geo.streetNumber ?? null;
      twin.address.postcode = geo.postcode ?? twin.address.postcode;
      twin.address.locality = geo.locality ?? null;
      twin.address.province = geo.province ?? null;
      twin.address.googlePlaceId = geo.googlePlaceId ?? null;
    }
  }

  if (lat == null || lng == null) {
    geocodingSource = "missing";
    warnings.push("Sin coordenadas: hay que marcar el punto en el mapa.");
  } else {
    twin.address.lat = lat;
    twin.address.lng = lng;
  }

  const refExplicita = input.catastralRef?.replace(/\s/g, "") || null;
  const via = refExplicita ? null : viaDesde(geo, direccion);
  let unidades: TwinUnit[] | undefined;
  try {
    const local = await deps.catastroLocal({ ref: refExplicita ?? undefined, lat: lat ?? undefined, lng: lng ?? undefined });
    if (local) aplicarCatastro(twin, sources, local, "catastro_local");
  } catch (err) {
    warnings.push(`Catastro local: ${aviso(err)}`);
  }
  try {
    const sede = await deps.catastroSede({
      ref: refExplicita ?? undefined,
      via: via ?? undefined,
      address: refExplicita || via ? undefined : direccion ?? undefined,
      lat: refExplicita || via || direccion ? undefined : lat ?? undefined,
      lng: refExplicita || via || direccion ? undefined : lng ?? undefined,
    });
    if (sede.warning) warnings.push(sede.warning);
    if (sede.hit) {
      if (sede.hit.centroid) {
        lat = sede.hit.centroid.lat;
        lng = sede.hit.centroid.lng;
        twin.address.lat = lat;
        twin.address.lng = lng;
        geocodingSource = "catastro";
      }
      if (sede.hit.unitRef) twin.address.catastralRef = sede.hit.unitRef;
      else if (sede.hit.parcelRef) twin.address.catastralRef = sede.hit.parcelRef;
      aplicarCatastro(twin, sources, sede.hit, "catastro_sede");
      if (sede.hit.units.length > 1) unidades = ordenarUnidades(sede.hit.units);
    }
  } catch (err) {
    warnings.push(`Sede del Catastro: ${aviso(err)}`);
  }

  const zone = { censusSection: null as string | null, municipalityCode: null as string | null, postcode: twin.address.postcode };
  if (lat != null && lng != null) {
    try {
      const punto = await deps.zoneAt(lat, lng);
      zone.censusSection = punto.censusSection;
      zone.municipalityCode = punto.municipalityCode;
      twin.address.censusSection = punto.censusSection;
      twin.address.municipalityCode = punto.municipalityCode;
    } catch (err) {
      warnings.push(`Sección censal: ${aviso(err)}`);
    }
    try {
      const cp = await deps.postcodeAt(lat, lng);
      if (cp) {
        twin.address.postcode = cp;
        zone.postcode = cp;
      }
    } catch (err) {
      warnings.push(`Código postal: ${aviso(err)}`);
    }
  }

  if (unidades && unidades.length > 1) {
    twin.builtSurface = null;
    twin.floorOfFlat = null;
    delete sources.builtSurface;
    delete sources.floorOfFlat;
    warnings.push("El edificio tiene varias unidades: hay que elegir una antes de seguir.");
  }

  if (ficha) aplicarFicha(twin, sources, ficha);

  const propertySource = fuenteGanadora(sources);
  const prefilledFields = new Set(Object.keys(sources) as (keyof Twin)[]);
  const out: TwinBuild = {
    twin,
    prefilledFields,
    fieldSources: sources,
    propertySource,
    geocodingSource,
    zone,
    warnings,
  };
  if (unidades && unidades.length > 1) out.units = unidades;
  if (ficha?.source === "listing" && ficha.price != null) out.listingPrice = ficha.price;
  return out;
}

export async function buildTwin(input: TwinInput, ctx: TwinCtx, deps?: Partial<TwinDeps>): Promise<TwinBuild> {
  try {
    return await ejecutar(input, ctx, { ...depsReales(ctx), ...deps });
  } catch (err) {
    return manual(input, [`No se ha podido construir el gemelo: ${aviso(err)}`]);
  }
}
