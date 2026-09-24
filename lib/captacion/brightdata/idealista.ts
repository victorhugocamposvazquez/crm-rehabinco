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

export const PARSER_VERSION = "brightdata-idealista-listado-2026-09-23";

/** Listado de venta de la ciudad de A Coruña. */
export const URL_PARTICULARES_CORUNA = "https://www.idealista.com/venta-viviendas/a-coruna-a-coruna/";

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
  const candidatos: string[] = [];
  const meter = (item: unknown) => {
    const url = texto(item);
    if (!url || !/^https?:\/\//i.test(url) || /video\.master/i.test(url)) return;
    candidatos.push(url);
  };
  if (Array.isArray(valor)) valor.forEach(meter);
  else meter(valor);
  if (candidatos.length === 0) meter(campo(raw, ["thumbnail", "thumb", "image", "photo"]));

  const porId = new Map<string, string>();
  const sueltos: string[] = [];
  for (const url of candidatos) {
    const id = url.match(/id\.pro\.es\.image\.master\/([^./?]+)/i)?.[1];
    if (!id) {
      sueltos.push(url);
      continue;
    }
    const previa = porId.get(id);
    if (!previa || rangoFoto(url) > rangoFoto(previa)) porId.set(id, url);
  }
  return [...porId.values(), ...sueltos];
}

function rangoFoto(url: string): number {
  if (url.includes("WEB_DETAIL-XL-L")) return 3;
  if (url.includes("WEB_DETAIL")) return 2;
  return 1;
}

function telefonoAjax(valor: unknown): string | null {
  let obj = valor;
  if (typeof valor === "string") {
    const t = valor.trim();
    if (!t.startsWith("{") && !t.startsWith("[")) {
      // Un número suelto sí vale. El HTML del desafío de Idealista, no.
      if (/<[a-z!]/i.test(t)) return null;
      return /^[+\d][\d\s().-]{8,}$/.test(t) ? t : null;
    }
    try {
      obj = JSON.parse(t) as unknown;
    } catch {
      return null;
    }
  }
  if (!esRegistro(obj)) return null;
  for (const clave of ["phone1", "phone2", "phone3", "phone"]) {
    const tel = obj[clave];
    if (typeof tel === "string" && tel.trim()) return tel;
    if (esRegistro(tel)) {
      const n = texto(tel.number ?? tel.formatted ?? tel.phoneNumber);
      if (n) return n;
    }
  }
  return null;
}

function telefonoDe(raw: Registro): string | null {
  const candidatos = [
    telefonoAjax(raw.telefono_ajax),
    telefonoAjax(raw.contact_phones),
    texto(campo(raw, ["phone", "telephone", "telefono", "teléfono", "phone1", "contact_phone", "mobile"])),
  ];
  for (const candidato of candidatos) {
    const numero = normalizarTelefono(candidato);
    if (numero) return numero;
  }
  return null;
}

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/** Fecha de Idealista, no la hora en que el CRM guardó el anuncio. */
export function fechaPortalIdealista(textoFecha: string | null, ahora = new Date()): string | null {
  if (!textoFecha) return null;
  const limpio = textoFecha.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(limpio)) {
    const iso = Date.parse(limpio);
    if (!Number.isNaN(iso)) return new Date(iso).toISOString();
  }
  const t = limpio.toLowerCase();
  const diaLocal = (fecha: Date) =>
    new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12)).toISOString();
  if (/\bhoy\b/.test(t) || /hace\s+(un|una|\d+)\s+horas?/.test(t)) return diaLocal(ahora);
  if (/\bayer\b/.test(t) || /hace\s+(un|1)\s+d[ií]a\b/.test(t)) {
    const d = new Date(ahora);
    d.setDate(d.getDate() - 1);
    return diaLocal(d);
  }
  const hace = t.match(/hace\s+(\d+)\s+d[ií]as/);
  if (hace) {
    const d = new Date(ahora);
    d.setDate(d.getDate() - Number(hace[1]));
    return diaLocal(d);
  }
  const m = t.match(
      /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?/
    );
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = MESES[m[2]] ?? 0;
  if (!mes || dia < 1 || dia > 31) return null;
  let anio = m[3] ? Number(m[3]) : ahora.getFullYear();
  if (!m[3]) {
    const candidata = new Date(anio, mes - 1, dia, 12);
    if (candidata.getTime() > ahora.getTime() + 86400000) anio -= 1;
  }
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, 12));
  if (fecha.getUTCDate() !== dia) return null;
  return fecha.toISOString();
}

const CLAVES_FECHA = [
  "published_at",
  "publicado_en",
  "publication_date",
  "date_posted",
  "datePosted",
  "listing_date",
  "publication_text",
  "updated_text",
  "date_text",
  "stats",
];

function fechaDe(raw: Registro): string | null {
  for (const clave of CLAVES_FECHA) {
    const iso = fechaPortalIdealista(texto(campo(raw, [clave])));
    if (iso) return iso;
  }
  return null;
}

/** Teléfono y fecha aunque la ficha no tenga título ni precio. No crea un anuncio vacío. */
export function datosPortalDe(raw: unknown): { externoId: string; telefono: string | null; publicado_en: string | null } | null {
  if (!esRegistro(raw)) return null;
  const url = normalizarTexto(texto(campo(raw, ["url", "listing_url", "link", "property_url"])));
  const crudoId = texto(
    campo(raw, ["property_code", "propertyCode", "listing_id", "ad_id", "externo_id", "id", "reference"])
  );
  const externoId = idDesdeUrl(url) ?? crudoId?.replace(/\D/g, "") ?? "";
  if (!/^\d{5,}$/.test(externoId)) return null;
  return { externoId, telefono: telefonoDe(raw), publicado_en: fechaDe(raw) };
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

/** Ficha que solo trajo el id: sin título real y sin precio ni foto. */
export function anuncioIdealistaVacio(row: {
  titulo?: string | null;
  precio?: number | null;
  thumb?: string | null;
}): boolean {
  const titulo = (row.titulo ?? "").trim();
  if (/^Anuncio \d+$/.test(titulo)) return true;
  return row.precio == null && !row.thumb;
}

export function urlFichaIdealista(externoId: string, url?: string | null): string | null {
  if (url && /idealista\.com\/inmueble\/\d+/i.test(url)) return url;
  if (!/^\d{5,}$/.test(externoId)) return null;
  return `https://www.idealista.com/inmueble/${externoId}/`;
}
export function esMarcadorListado(raw: Registro): boolean {
  return Number(raw.items_en_pagina) === 0;
}

export function mapearBrightDataIdealista(raw: Registro): AnuncioEntrante | null {
  if (esMarcadorListado(raw)) return null;
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
  const tituloPortal = normalizarTexto(texto(campo(raw, ["title", "property_title", "titulo", "name"])));
  const fotos = fotosDe(raw);
  const precio = normalizarPrecio(campo(raw, ["price", "precio", "amount"]));
  const esListado = raw.listing_position != null || raw.items_en_pagina != null;
  // Una ficha que no cargó llega solo con la URL. Un listado sin teléfono sí es válido.
  if (!esListado && !tituloPortal && precio == null && fotos.length === 0) return null;
  const titulo =
    tituloPortal ||
    [direccion, zona, municipio].filter(Boolean).join(", ") ||
    `Anuncio ${externoId}`;
  const telefono = telefonoDe(raw);
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
    descripcion: normalizarTexto(
      texto(campo(raw, ["description", "description_snippet", "descripcion", "comment"]))
    ),
    operacion: normalizarOperacion(texto(campo(raw, ["operation", "operacion", "listing_type", "transaction"]))),
    tipo: normalizarTipo(texto(campo(raw, ["property_type", "propertyType", "tipo", "type", "building_type"]))),
    anunciante: anuncianteDe(raw),
    precio,
    superficie: normalizarM2(campo(raw, ["size", "surface", "superficie", "sqm", "m2", "area_m2"])),
    habitaciones: normalizarPrecio(campo(raw, ["rooms", "habitaciones", "bedrooms", "num_rooms"])),
    banos: normalizarPrecio(campo(raw, ["bathrooms", "banos", "baths", "num_baths"])),
    planta: normalizarTexto(texto(campo(raw, ["floor_text", "floor", "planta"]))),
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
    publicado_en: fechaDe(raw),
    raw,
  };
}

/** Bright Data a veces manda un JSON por línea. JSON.parse se para en el primero. */
export function parsearRespuestaDataset(texto: string): unknown {
  const limpio = texto.replace(/^\uFEFF/, "").trim();
  if (!limpio) return [];
  const valores = valoresJsonConcatenados(limpio);
  if (valores.length <= 1) return valores[0] ?? [];
  const registros: unknown[] = [];
  for (const valor of valores) {
    if (Array.isArray(valor)) {
      registros.push(...valor);
      continue;
    }
    if (!esRegistro(valor)) continue;
    const estado = String(valor.status ?? valor.Status ?? "");
    if (/^(running|collecting|building|starting|pending)$/i.test(estado) && !("url" in valor)) continue;
    const lista = ["data", "results", "records", "items"].map((clave) => valor[clave]).find(Array.isArray);
    if (Array.isArray(lista)) {
      registros.push(...lista);
      continue;
    }
    registros.push(valor);
  }
  return registros.length > 0 ? registros : valores[0];
}

function valoresJsonConcatenados(texto: string): unknown[] {
  const valores: unknown[] = [];
  let inicio = 0;
  while (inicio < texto.length) {
    while (inicio < texto.length && /\s/.test(texto[inicio] ?? "")) inicio += 1;
    if (inicio >= texto.length) break;
    const resto = texto.slice(inicio);
    try {
      valores.push(JSON.parse(resto));
      break;
    } catch (error) {
      if (!(error instanceof SyntaxError) || !/after JSON/i.test(error.message)) throw error;
      const marca = /position (\d+)/.exec(error.message);
      const pos = marca ? Number(marca[1]) : 0;
      if (pos <= 0 || pos >= resto.length) throw error;
      valores.push(JSON.parse(resto.slice(0, pos)));
      inicio += pos;
    }
  }
  return valores;
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
  const id = cuerpo.snapshot_id ?? cuerpo.snapshotId ?? cuerpo.collection_id ?? cuerpo.collectionId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}
