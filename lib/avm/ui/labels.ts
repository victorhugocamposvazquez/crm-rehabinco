import type { GeocodingSource } from "../twin-builder";
import type {
  Channel,
  MainType,
  PropertyType,
  SourceStatus,
  SourceUsed,
  Twin,
  ValuationResult,
  ZoneLevel,
} from "../types";

export const ETIQUETA_ESTADO_FUENTE: Record<SourceStatus, string> = {
  primary: "principal",
  fallback: "respaldo",
  degraded: "degradada",
  missing: "sin dato",
};

export const ETIQUETA_CAPA: Record<SourceUsed["layer"], string> = {
  geocoding: "Ubicación",
  property: "Inmueble",
  market: "Mercado de zona",
  close_series: "Cierre",
  comparables: "Comparables",
  rent: "Alquiler",
  environment: "Entorno",
};

export const ETIQUETA_MAIN_TYPE: Record<MainType, string> = {
  apartment: "Piso",
  house: "Casa",
  land: "Terreno",
  building: "Edificio",
};

export const ETIQUETA_PROPERTY_TYPE: Record<PropertyType, string> = {
  apartment: "Piso",
  studio: "Estudio",
  duplex: "Dúplex",
  penthouse: "Ático",
  house: "Casa",
  villa: "Chalet",
  townhouse: "Adosado",
  land: "Terreno",
  building: "Edificio",
};

export const ETIQUETA_NIVEL_ZONA: Record<ZoneLevel, string> = {
  postcode: "código postal",
  census_section: "sección censal",
  municipality: "municipio",
  province: "provincia",
  country: "país",
};

export const ETIQUETA_RANGE_METHOD: Record<NonNullable<ValuationResult["rangeMethod"]>, string> = {
  iqr: "P25–P75 de los comparables",
  iqr_shrunk: "P25–P75 amortiguado por pocos comparables",
};

export const ETIQUETA_RENT_SOURCE: Record<NonNullable<ValuationResult["rentSource"]>, string> = {
  comparables: "comparables de alquiler",
  zone_adjusted: "alquiler de la zona ajustado al inmueble",
  yield: "rentabilidad bruta de la zona",
};

/** Método de alquiler visible. Las valoraciones anteriores a comparables-1.1 no guardaban la fuente. */
export function etiquetaMetodoAlquiler(
  methodVersion: string | null | undefined,
  rentSource: ValuationResult["rentSource"],
): string {
  if (!methodVersion?.includes("1.1")) return "rentabilidad bruta de la zona (método 1.0)";
  if (rentSource) return ETIQUETA_RENT_SOURCE[rentSource];
  return "—";
}

export const ETIQUETA_GEOCODING: Record<GeocodingSource, string> = {
  google: "Google (geocodificación)",
  cartociudad: "CartoCiudad",
  postcode_centroid: "centroide del código postal",
  pin: "punto en el mapa",
  listing: "ubicación del anuncio",
  catastro: "Catastro, punto del edificio",
  missing: "no disponible",
};

type PropertyMotorSource = "catastro_sede" | "catastro_local" | "catastro_live" | "listing" | "manual";

export const ETIQUETA_PROPERTY_SOURCE: Record<PropertyMotorSource, string> = {
  catastro_sede: "Catastro, Sede en vivo",
  catastro_local: "Catastro, copia local",
  catastro_live: "Catastro, Sede en vivo",
  listing: "datos del anuncio",
  manual: "formulario manual",
};

type MarketMotorSource = "country_base" | "market_listings";

export const ETIQUETA_MARKET_SOURCE: Record<MarketMotorSource, string> = {
  country_base: "referencia nacional",
  market_listings: "anuncios",
};

type CloseMotorSource = "market_discount" | "default_8pct";

export const ETIQUETA_CLOSE_SOURCE: Record<CloseMotorSource, string> = {
  market_discount: "serie de cierre de la zona",
  default_8pct: "8 % por defecto, sin cierres propios",
};

type RentMotorSource = "avm_comparables/rent" | "gross_yield" | "none";

export const ETIQUETA_RENT_LAYER_SOURCE: Record<RentMotorSource, string> = {
  "avm_comparables/rent": "comparables de alquiler",
  gross_yield: "rentabilidad bruta de la zona",
  none: "no disponible hasta la fase 2",
};

type EnvMotorSource = "environment_layers" | "none";

export const ETIQUETA_ENV_SOURCE: Record<EnvMotorSource, string> = {
  environment_layers: "capas locales (OSM, transporte, ruido…)",
  none: "no disponible hasta la fase 2",
};

type CompMotorSource = "none";

export const ETIQUETA_COMP_STATIC: Record<CompMotorSource, string> = {
  none: "no disponible hasta la fase 2",
};

export const ETIQUETA_AJUSTE: Record<string, string> = {
  size: "tamaño",
  floor: "planta",
  side: "exterior/interior",
  condition: "estado",
  garage: "garaje",
  terrace: "terraza",
  renovated: "reforma",
};

export const ETIQUETA_CANAL: Record<Channel, string> = {
  crm: "CRM",
  landing: "Landing",
  batch: "Lote",
};

export type FuenteEtiquetaContext = {
  zoneKey?: string;
  comparablesCount?: number;
  comparablesRadiusM?: number;
};

export function etiquetaTipoInmueble(twin: Twin): string {
  if (twin.propertyType) return ETIQUETA_PROPERTY_TYPE[twin.propertyType];
  if (twin.mainType) return ETIQUETA_MAIN_TYPE[twin.mainType];
  return "Inmueble";
}

export function etiquetaMotorFuente(source: string, ctx: FuenteEtiquetaContext = {}): string {
  if (source in ETIQUETA_GEOCODING) return ETIQUETA_GEOCODING[source as GeocodingSource];
  if (source in ETIQUETA_PROPERTY_SOURCE) return ETIQUETA_PROPERTY_SOURCE[source as PropertyMotorSource];
  if (source in ETIQUETA_CLOSE_SOURCE) return ETIQUETA_CLOSE_SOURCE[source as CloseMotorSource];
  if (source in ETIQUETA_RENT_LAYER_SOURCE) return ETIQUETA_RENT_LAYER_SOURCE[source as RentMotorSource];
  if (source in ETIQUETA_ENV_SOURCE) return ETIQUETA_ENV_SOURCE[source as EnvMotorSource];
  if (source in ETIQUETA_COMP_STATIC) return ETIQUETA_COMP_STATIC[source as CompMotorSource];
  if (source in ETIQUETA_MARKET_SOURCE) return ETIQUETA_MARKET_SOURCE[source as MarketMotorSource];

  const market = /^market_listings\/(postcode|census_section|municipality)$/.exec(source);
  if (market) {
    const nivel = ETIQUETA_NIVEL_ZONA[market[1] as "postcode" | "census_section" | "municipality"];
    const clave = ctx.zoneKey ? ` ${ctx.zoneKey}` : "";
    return `anuncios · ${nivel}${clave}`;
  }

  const comps = /^avm_comparables\/(\d+)m$/.exec(source);
  if (comps) {
    const n = ctx.comparablesCount ?? 0;
    const radio = comps[1];
    return `${n} anuncios a ${radio} m`;
  }

  const zoneRent = /^zone\/(postcode|census_section|municipality)$/.exec(source);
  if (zoneRent) {
    return `anuncios de alquiler · ${ETIQUETA_NIVEL_ZONA[zoneRent[1] as ZoneLevel]}`;
  }

  return source;
}

export function chipFuenteCapa(s: SourceUsed, ctx: FuenteEtiquetaContext): string {
  const capa = ETIQUETA_CAPA[s.layer];
  const detalle = etiquetaMotorFuente(s.source, {
    ...ctx,
    comparablesRadiusM: s.layer === "comparables" ? parseInt(/^avm_comparables\/(\d+)m$/.exec(s.source)?.[1] ?? "0", 10) : ctx.comparablesRadiusM,
  });
  return `${capa} · ${detalle}`;
}

export function etiquetaPenalizacion(reason: string, ctx: FuenteEtiquetaContext = {}): string {
  const capaFuente = /^(\w+): (\w+) \((.+)\)$/.exec(reason);
  if (capaFuente) {
    const [, layer, status, source] = capaFuente;
    const capa = ETIQUETA_CAPA[layer as SourceUsed["layer"]] ?? layer;
    if (layer === "close_series" && status === "degraded" && source === "default_8pct") {
      return "Descuento oferta → cierre por defecto, sin cierres propios";
    }
    if (layer === "property" && source === "catastro_local") {
      return "Catastro servido desde caché";
    }
    const fuente = etiquetaMotorFuente(source, ctx);
    const est = ETIQUETA_ESTADO_FUENTE[status as SourceStatus] ?? status;
    return `${capa}: ${fuente} (${est})`;
  }

  const pocos = /^pocos comparables \((\d+) de 12\)$/.exec(reason);
  if (pocos) return `${pocos[1]} de 12 comparables`;

  const dispersion = /^dispersión de comparables (\d+) %$/.exec(reason);
  if (dispersion) return `Dispersión de comparables ${dispersion[1]} %`;

  if (reason === "sin histórico de 12 meses en la zona") return "Sin histórico de 12 meses en la zona";

  const radio = /^radio de comparables (\d+) m$/.exec(reason);
  if (radio) return `Radio de búsqueda ${enteroEs(Number(radio[1]))} m`;

  const form = /^formulario al (\d+) %$/.exec(reason);
  if (form) return `Formulario al ${form[1]} %`;

  return reason;
}

function enteroEs(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

type ReemplazoExplicacion = string | ((match: string, ...groups: string[]) => string);

const REEMPLAZOS_EXPLICACION: [RegExp, ReemplazoExplicacion][] = [
  [/\bclose_series\b/g, ETIQUETA_CAPA.close_series],
  [/\bdefault_8pct\b/g, ETIQUETA_CLOSE_SOURCE.default_8pct],
  [/\bmarket_discount\b/g, ETIQUETA_CLOSE_SOURCE.market_discount],
  [/\biqr_shrunk\b/g, ETIQUETA_RANGE_METHOD.iqr_shrunk],
  [/\biqr\b/g, ETIQUETA_RANGE_METHOD.iqr],
  [/\bcatastro_sede\b/g, ETIQUETA_PROPERTY_SOURCE.catastro_sede],
  [/\bcatastro_local\b/g, ETIQUETA_PROPERTY_SOURCE.catastro_local],
  [/\bavm_comparables\/(\d+)m\b/g, (_match, metros) => `comparables a ${metros} m`],
  [/\bmarket_listings\/postcode\b/g, "anuncios · código postal"],
  [/\bmarket_listings\/census_section\b/g, "anuncios · sección censal"],
  [/\bmarket_listings\/municipality\b/g, "anuncios · municipio"],
];

export function humanizarExplicacion(linea: string, ctx: FuenteEtiquetaContext = {}): string {
  let out = linea;
  for (const [re, repl] of REEMPLAZOS_EXPLICACION) {
    if (typeof repl === "string") out = out.replace(re, repl);
    else out = out.replace(re, repl);
  }
  if (ctx.zoneKey) {
    out = out.replace(new RegExp(`\\b${ctx.zoneKey}\\b`, "g"), ctx.zoneKey);
  }
  return out;
}

export function tituloInforme(twin: Twin): string {
  const base = twin.address.formattedAddress?.trim();
  if (!base) return "Valoración";
  if (twin.floorOfFlat != null && twin.floorOfFlat >= 0 && !/\d+\s*º/.test(base)) {
    return `${base}, ${twin.floorOfFlat}º`;
  }
  return base;
}

export function migaInforme(twin: Twin): string {
  const addr = twin.address.formattedAddress ?? "Informe";
  const corto = addr.split(",")[0]?.trim() || addr;
  return corto;
}

export function subtituloInforme(twin: Twin, creada: string, methodVersion: string): string {
  const loc = [twin.address.postcode, twin.address.locality].filter(Boolean).join(" ");
  return [
    etiquetaTipoInmueble(twin),
    twin.builtSurface ? `${twin.builtSurface} m²` : null,
    loc || null,
    creada,
    `método ${methodVersion}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function tituloMercadoZona(zona: NonNullable<ValuationResult["zoneStats"]>): string {
  const partes = zona.label.split("·").map((s) => s.trim());
  const ciudad = partes[0] ?? zona.label;
  const nivel = ETIQUETA_NIVEL_ZONA[zona.zoneLevel];
  const clave = zona.zoneKey;
  return `Mercado de la zona · ${ciudad} · ${nivel} ${clave}`;
}

export function claseConfianza(confidence: number): "good" | "warn" | "bad" {
  if (confidence >= 75) return "good";
  if (confidence >= 50) return "warn";
  return "bad";
}

export function etiquetaConfianzaCorta(confidence: number): string {
  return confidence >= 75 ? "Alta" : confidence >= 50 ? "Media" : "Baja";
}
