import {
  normalizarAnunciante,
  normalizarM2,
  normalizarOperacion,
  normalizarPrecio,
  normalizarTelefono,
  normalizarTexto,
  normalizarTipo,
} from "@/lib/captacion/pipeline/normalize";
import type { AnuncioEntrante, AnunciantePortal } from "@/lib/captacion/portales/modelo";

export const PARSER_VERSION = "brightdata-idealista-2026-09-22";

/** Listado de venta de particulares en A Coruña. Se puede sustituir con BRIGHTDATA_IDEALISTA_URL. */
export const URL_PARTICULARES_CORUNA =
  "https://www.idealista.com/venta-viviendas/a-coruna-a-coruna/con-particulares/";

type Registro = Record<string, unknown>;

function esRegistro(valor: unknown): valor is Registro {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

function texto(valor: unknown): string | null {
  if (typeof valor === "string") return valor.trim() || null;
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  if (esRegistro(valor)) {
    return texto(valor.phoneNumber ?? valor.phone ?? valor.number ?? valor.url ?? valor.src ?? valor.name);
  }
  return null;
}

function numero(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  const t = texto(valor);
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function anidado(raw: Registro, clave: string): Registro | null {
  const valor = raw[clave];
  return esRegistro(valor) ? valor : null;
}

/** Primer valor no vacío entre el registro y los objetos de contacto o dirección. */
function campo(raw: Registro, claves: string[]): unknown {
  const bolsas = [
    raw,
    anidado(raw, "contact"),
    anidado(raw, "contact_info"),
    anidado(raw, "contactInfo"),
    anidado(raw, "seller"),
    anidado(raw, "advertiser"),
    anidado(raw, "location"),
    anidado(raw, "address"),
    anidado(raw, "property"),
  ].filter((b): b is Registro => Boolean(b));
  for (const bolsa of bolsas) {
    for (const clave of claves) {
      const valor = bolsa[clave];
      if (valor == null || valor === "") continue;
      return valor;
    }
  }
  return null;
}

function idDesdeUrl(url: string | null): string | null {
  if (!url) return null;
  const ficha = url.match(/idealista\.com\/inmueble\/(\d+)/i);
  return ficha?.[1] ?? null;
}

function fotosDe(raw: Registro): string[] {
  const valor = campo(raw, ["photos", "images", "fotos", "gallery", "pictures"]);
  if (!Array.isArray(valor)) {
    const una = texto(campo(raw, ["thumbnail", "thumb", "image", "photo"]));
    return una ? [una] : [];
  }
  const urls: string[] = [];
  for (const item of valor) {
    const url = texto(item);
    if (url && /^https?:\/\//i.test(url)) urls.push(url);
  }
  return urls;
}

function anuncianteDe(raw: Registro): AnunciantePortal {
  const explicito = texto(
    campo(raw, [
      "seller_type",
      "advertiser_type",
      "user_type",
      "userType",
      "anunciante",
      "publisher_type",
      "contact_type",
    ])
  );
  if (explicito) return normalizarAnunciante(explicito);
  const profesional = campo(raw, ["professional", "is_agency", "isAgency", "is_professional"]);
  if (profesional === true || profesional === "true") return "empresa";
  if (profesional === false || profesional === "false") return "particular";
  return "particular";
}

/** Traduce un registro del collector de Bright Data al anuncio que guarda el CRM. */
export function mapearBrightDataIdealista(raw: Registro): AnuncioEntrante | null {
  const url = normalizarTexto(texto(campo(raw, ["url", "listing_url", "link", "property_url"])));
  const crudoId = texto(
    campo(raw, ["property_code", "propertyCode", "listing_id", "ad_id", "externo_id", "id", "reference"])
  );
  const externoId = idDesdeUrl(url) ?? crudoId?.replace(/\D/g, "") ?? "";
  if (!/^\d{5,}$/.test(externoId)) return null;

  const municipio = normalizarTexto(
    texto(campo(raw, ["municipality", "municipio", "city", "locality", "town"]))
  );
  const zona = normalizarTexto(
    texto(campo(raw, ["neighborhood", "neighbourhood", "district", "zona", "area"]))
  );
  const direccion = normalizarTexto(texto(campo(raw, ["address", "direccion", "street"])));
  const titulo =
    normalizarTexto(texto(campo(raw, ["title", "property_title", "titulo", "name"]))) ||
    [direccion, zona, municipio].filter(Boolean).join(", ") ||
    `Anuncio ${externoId}`;
  const fotos = fotosDe(raw);
  const telefono = normalizarTelefono(
    texto(campo(raw, ["phone", "telephone", "telefono", "phone1", "contact_phone", "mobile"]))
  );
  const nombre = normalizarTexto(
    texto(campo(raw, ["contact_name", "seller_name", "advertiser_name", "owner_name", "contacto_nombre", "name"]))
  );
  const comercial = normalizarTexto(
    texto(campo(raw, ["commercial_name", "agency_name", "nombre_comercial", "company"]))
  );

  return {
    fuente: "idealista",
    portal_id: "idealista",
    externo_id: externoId,
    url: url ?? `https://www.idealista.com/inmueble/${externoId}/`,
    titulo,
    descripcion: normalizarTexto(texto(campo(raw, ["description", "descripcion", "comment"]))),
    operacion: normalizarOperacion(texto(campo(raw, ["operation", "operacion", "listing_type", "transaction"]))),
    tipo: normalizarTipo(texto(campo(raw, ["property_type", "propertyType", "tipo", "type", "building_type"]))),
    anunciante: anuncianteDe(raw),
    precio: normalizarPrecio(campo(raw, ["price", "precio", "amount"])),
    superficie: normalizarM2(campo(raw, ["size", "surface", "superficie", "sqm", "m2", "area_m2"])),
    habitaciones: normalizarPrecio(campo(raw, ["rooms", "habitaciones", "bedrooms", "num_rooms"])),
    banos: normalizarPrecio(campo(raw, ["bathrooms", "banos", "baths", "num_baths"])),
    planta: normalizarTexto(texto(campo(raw, ["floor", "planta"]))),
    direccion,
    zona: zona ?? municipio,
    municipio,
    codigo_postal: normalizarTexto(texto(campo(raw, ["postal_code", "codigo_postal", "zip"]))),
    lat: numero(campo(raw, ["latitude", "lat"])),
    lng: numero(campo(raw, ["longitude", "lng", "lon"])),
    thumb: fotos[0] ?? null,
    n_fotos: fotos.length || normalizarPrecio(campo(raw, ["num_photos", "n_fotos", "photos_count"])),
    fotos,
    contacto_nombre: nombre && nombre !== titulo ? nombre : null,
    contacto_telefono: telefono,
    nombre_comercial: comercial && comercial !== nombre ? comercial : null,
    publicado_en: normalizarTexto(texto(campo(raw, ["published_at", "publicado_en", "date", "listing_date"]))),
    raw,
  };
}

/** Saca la lista de anuncios de un webhook o de un snapshot de Bright Data. */
export function registrosBrightData(cuerpo: unknown): Registro[] {
  if (Array.isArray(cuerpo)) return cuerpo.filter(esRegistro);
  if (!esRegistro(cuerpo)) return [];
  for (const clave of ["data", "results", "records", "items"]) {
    const lista = cuerpo[clave];
    if (Array.isArray(lista)) return lista.filter(esRegistro);
  }
  if (typeof cuerpo.snapshot_id === "string" || typeof cuerpo.snapshotId === "string") return [];
  if (campo(cuerpo, ["url", "property_code", "propertyCode", "listing_id"])) return [cuerpo];
  return [];
}

export function snapshotIdDe(cuerpo: unknown): string | null {
  if (!esRegistro(cuerpo)) return null;
  const id = cuerpo.snapshot_id ?? cuerpo.snapshotId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}
