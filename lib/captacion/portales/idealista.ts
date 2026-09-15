import {
  claveContacto,
  type AnunciantePortal,
  type AnuncioEntrante,
  type TipoAnuncioPortal,
} from "./modelo";

export type IdealistaContact = {
  commercialName?: string | null;
  phone1?: string | { phoneNumber?: string | null } | null;
  userType?: string | null;
  contactName?: string | null;
};

export type IdealistaElement = {
  propertyCode?: string | number | null;
  thumbnail?: string | null;
  numPhotos?: number | null;
  price?: number | null;
  propertyType?: string | null;
  operation?: string | null;
  size?: number | null;
  rooms?: number | null;
  bathrooms?: number | null;
  address?: string | null;
  province?: string | null;
  municipality?: string | null;
  district?: string | null;
  neighborhood?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  url?: string | null;
  description?: string | null;
  status?: string | null;
  contactInfo?: IdealistaContact | null;
  professional?: boolean | null;
  thumbnailRetina?: string | null;
};

export function anuncianteIdealista(info?: IdealistaContact | null, professional?: boolean | null): AnunciantePortal {
  const tipo = (info?.userType ?? "").toLowerCase();
  if (tipo === "private" || tipo === "particular" || tipo === "user") return "particular";
  if (tipo === "developer" || tipo === "bank" || tipo === "banco") return "banco";
  if (tipo === "professional" || tipo === "agency" || tipo === "inmobiliaria") return "empresa";
  if (professional) return "empresa";
  return "desconocido";
}

export function tipoIdealista(propertyType?: string | null): TipoAnuncioPortal | null {
  const t = (propertyType ?? "").toLowerCase();
  if (!t) return null;
  if (["flat", "studio", "penthouse", "duplex", "apartment", "homes", "home"].includes(t)) return "piso";
  if (["chalet", "countryhouse", "villa", "house", "countryhouses"].includes(t)) return "casa";
  if (["building", "buildings", "andar"].includes(t)) return "edificio";
  if (["premises", "premise", "office", "offices", "warehouse", "industrial"].includes(t)) return "local";
  if (["land", "lands", "solar", "plot"].includes(t)) return "terreno";
  return null;
}

function telefonoDe(info?: IdealistaContact | null): string | null {
  const phone = info?.phone1;
  if (!phone) return null;
  if (typeof phone === "string") return phone.trim() || null;
  return phone.phoneNumber?.trim() || null;
}

export function mapearIdealista(element: IdealistaElement): AnuncioEntrante | null {
  const externo = element.propertyCode == null ? "" : String(element.propertyCode).trim();
  if (!externo) return null;
  const municipio = element.municipality?.trim() || null;
  const zona = element.neighborhood?.trim() || element.district?.trim() || municipio;
  const titulo = element.address?.trim() || [zona, municipio].filter(Boolean).join(", ") || `Anuncio ${externo}`;
  const tel = telefonoDe(element.contactInfo);
  const nombre = element.contactInfo?.contactName?.trim() || element.contactInfo?.commercialName?.trim() || null;
  const operacion = element.operation === "rent" ? "alquiler" : "venta";
  const url =
    element.url?.trim() ||
    `https://www.idealista.com/inmueble/${externo}/`;
  return {
    fuente: "idealista",
    externo_id: externo,
    url,
    titulo,
    descripcion: element.description?.trim() || null,
    operacion,
    tipo: tipoIdealista(element.propertyType),
    anunciante: anuncianteIdealista(element.contactInfo, element.professional),
    precio: typeof element.price === "number" ? element.price : null,
    superficie: typeof element.size === "number" ? element.size : null,
    habitaciones: typeof element.rooms === "number" ? element.rooms : null,
    banos: typeof element.bathrooms === "number" ? element.bathrooms : null,
    direccion: element.address?.trim() || null,
    zona,
    municipio,
    codigo_postal: null,
    lat: typeof element.latitude === "number" ? element.latitude : null,
    lng: typeof element.longitude === "number" ? element.longitude : null,
    thumb: element.thumbnailRetina || element.thumbnail || null,
    n_fotos: typeof element.numPhotos === "number" ? element.numPhotos : null,
    contacto_nombre: nombre,
    contacto_telefono: tel,
    publicado_en: null,
    raw: element as Record<string, unknown>,
  };
}

export function claveDeEntrante(item: AnuncioEntrante): string | null {
  return claveContacto(item.contacto_telefono, item.contacto_nombre, item.municipio);
}

export type IdealistaSearchParams = {
  operation: "sale" | "rent";
  propertyType: "homes" | "offices" | "premises" | "garages" | "bedrooms";
  center: string;
  distance: number;
  maxItems: number;
  numPage: number;
  language: "es";
  maxPrice?: number;
  minSize?: number;
  sinceDate?: "W" | "M" | "T";
};

export function paramsIdealistaDesdeAlerta(input: {
  operacion: "venta" | "alquiler";
  tipo: string | null;
  precio_max: number | null;
  m2_min: number | null;
  lat: number;
  lng: number;
  radio_m: number;
  numPage: number;
}): IdealistaSearchParams {
  const tipo = (input.tipo ?? "").toLowerCase();
  let propertyType: IdealistaSearchParams["propertyType"] = "homes";
  if (tipo === "local") propertyType = "premises";
  if (tipo === "oficina") propertyType = "offices";
  return {
    operation: input.operacion === "alquiler" ? "rent" : "sale",
    propertyType,
    center: `${input.lat},${input.lng}`,
    distance: Math.min(Math.max(input.radio_m, 500), 60000),
    maxItems: 50,
    numPage: input.numPage,
    language: "es",
    maxPrice: input.precio_max ?? undefined,
    minSize: input.m2_min ?? undefined,
    sinceDate: "M",
  };
}

export function bodyIdealista(params: IdealistaSearchParams): string {
  const data = new URLSearchParams();
  data.set("operation", params.operation);
  data.set("propertyType", params.propertyType);
  data.set("center", params.center);
  data.set("distance", String(params.distance));
  data.set("maxItems", String(params.maxItems));
  data.set("numPage", String(params.numPage));
  data.set("language", params.language);
  if (params.maxPrice != null) data.set("maxPrice", String(params.maxPrice));
  if (params.minSize != null) data.set("minSize", String(params.minSize));
  if (params.sinceDate) data.set("sinceDate", params.sinceDate);
  return data.toString();
}

let tokenCache: { value: string; expira: number } | null = null;

export function idealistaConfigurado(): boolean {
  return Boolean(process.env.IDEALISTA_API_KEY?.trim() && process.env.IDEALISTA_API_SECRET?.trim());
}

async function tokenIdealista(): Promise<string> {
  if (tokenCache && tokenCache.expira > Date.now() + 30_000) return tokenCache.value;
  const key = process.env.IDEALISTA_API_KEY?.trim();
  const secret = process.env.IDEALISTA_API_SECRET?.trim();
  if (!key || !secret) throw new Error("Faltan IDEALISTA_API_KEY o IDEALISTA_API_SECRET.");
  const basic = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch("https://api.idealista.com/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=read",
  });
  if (!res.ok) {
    throw new Error(`Idealista OAuth ${res.status}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("Idealista no devolvió token.");
  tokenCache = {
    value: json.access_token,
    expira: Date.now() + Math.max(60, json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

export async function buscarIdealista(params: IdealistaSearchParams): Promise<{
  elementList: IdealistaElement[];
  totalPages: number;
  actualPage: number;
}> {
  const token = await tokenIdealista();
  const res = await fetch("https://api.idealista.com/3.5/es/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: bodyIdealista(params),
  });
  if (!res.ok) {
    throw new Error(`Idealista search ${res.status}`);
  }
  const json = (await res.json()) as {
    elementList?: IdealistaElement[];
    totalPages?: number;
    actualPage?: number;
  };
  return {
    elementList: json.elementList ?? [],
    totalPages: json.totalPages ?? 1,
    actualPage: json.actualPage ?? params.numPage,
  };
}
