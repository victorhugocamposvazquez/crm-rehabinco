/**
 * Edificios y portales del Catastro (INSPIRE WFS BU y AD) por recuadro del mapa.
 * Funciona en toda España (salvo País Vasco y Navarra, con catastro foral).
 *
 *  - wfsBU: bu-ext2d:Building, una entrada por parcela con uso, año, inmuebles,
 *    viviendas, superficie construida y huella en EPSG:4326 (lat lon).
 *  - wfsAD: ad:Address (portal) con número, vía (ThoroughfareName) y código postal.
 *
 * Solo se leen campos oficiales; sin dependencias (expresiones regulares, como
 * `lib/catastro/inspire-ad.ts`).
 */

export const CATASTRO_INSPIRE_BU_WFS = "https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx";
export const CATASTRO_INSPIRE_AD_WFS_BBOX = "https://ovc.catastro.meh.es/INSPIRE/wfsAD.aspx";
const CRS = "urn:ogc:def:crs:EPSG::4326";

/** Recuadro en grados: sur, oeste, norte, este. */
export interface Recuadro {
  sur: number;
  oeste: number;
  norte: number;
  este: number;
}

/** Lado máximo del recuadro que pedimos de una vez (~1 km); más grande, el WFS tarda o corta. */
export const LADO_MAX_GRADOS = 0.012;

export type UsoEdificio =
  | "residencial"
  | "agricola"
  | "industrial"
  | "oficinas"
  | "comercial"
  | "servicios_publicos"
  | "otro";

export const ETIQUETA_USO: Record<UsoEdificio, string> = {
  residencial: "Residencial",
  agricola: "Agrícola",
  industrial: "Industrial",
  oficinas: "Oficinas",
  comercial: "Comercial",
  servicios_publicos: "Servicios públicos",
  otro: "Otro",
};

export interface DireccionPortal {
  via: string;
  numero: string;
  codigoPostal: string | null;
  lat: number;
  lng: number;
}

export interface EdificioMapa {
  /** Referencia catastral de la parcela (14). */
  ref: string;
  uso: UsoEdificio;
  anio: number | null;
  inmuebles: number | null;
  viviendas: number | null;
  plantas: number | null;
  superficie: number | null;
  /** functional | declined | ruin | projected | underConstruction… */
  estado: string | null;
  lat: number;
  lng: number;
  /** Anillo exterior [lat, lng][]. */
  huella: [number, number][];
  fotoUrl: string;
  direcciones: DireccionPortal[];
}

export function urlEdificios(r: Recuadro): string {
  const u = new URL(CATASTRO_INSPIRE_BU_WFS);
  u.searchParams.set("service", "wfs");
  u.searchParams.set("version", "2.0.0");
  u.searchParams.set("request", "GetFeature");
  u.searchParams.set("typenames", "bu:Building");
  u.searchParams.set("srsname", CRS);
  u.searchParams.set("bbox", `${r.sur},${r.oeste},${r.norte},${r.este},${CRS}`);
  return u.toString();
}

export function urlPortales(r: Recuadro): string {
  const u = new URL(CATASTRO_INSPIRE_AD_WFS_BBOX);
  u.searchParams.set("service", "wfs");
  u.searchParams.set("version", "2.0.0");
  u.searchParams.set("request", "GetFeature");
  u.searchParams.set("typenames", "ad:Address");
  u.searchParams.set("srsname", CRS);
  u.searchParams.set("bbox", `${r.sur},${r.oeste},${r.norte},${r.este},${CRS}`);
  return u.toString();
}

/** Valida y normaliza "sur,oeste,norte,este". Null si no es un recuadro válido o es demasiado grande. */
export function parseRecuadro(texto: string | null | undefined): Recuadro | null {
  const n = (texto ?? "").split(",").map((v) => Number(v));
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null;
  const [sur, oeste, norte, este] = n;
  if (sur >= norte || oeste >= este) return null;
  if (sur < 26 || norte > 45 || oeste < -19 || este > 5) return null; // España con Canarias
  if (norte - sur > LADO_MAX_GRADOS || este - oeste > LADO_MAX_GRADOS * 1.4) return null;
  const r = (v: number) => Math.round(v * 1e5) / 1e5;
  return { sur: r(sur), oeste: r(oeste), norte: r(norte), este: r(este) };
}

function miembros(gml: string): string[] {
  return gml.split(/<gml:featureMember>/i).slice(1);
}

function texto(bloque: string, etiqueta: string): string | null {
  const m = bloque.match(new RegExp(`<${etiqueta}(?:\\s[^>]*)?>([^<]*)</${etiqueta}>`, "i"));
  const v = m?.[1]?.trim();
  return v ? v : null;
}

function entero(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function usoDesdeInspire(v: string | null): UsoEdificio {
  if (!v) return "otro";
  if (v.startsWith("1_")) return "residencial";
  if (v.startsWith("2_")) return "agricola";
  if (v.startsWith("3_")) return "industrial";
  if (v.startsWith("4_1")) return "oficinas";
  if (v.startsWith("4_2")) return "comercial";
  if (v.startsWith("4_3")) return "servicios_publicos";
  return "otro";
}

function anillo(posList: string): [number, number][] {
  const n = posList.trim().split(/\s+/).map(Number);
  const puntos: [number, number][] = [];
  for (let i = 0; i + 1 < n.length; i += 2) {
    if (Number.isFinite(n[i]) && Number.isFinite(n[i + 1])) puntos.push([n[i], n[i + 1]]);
  }
  return puntos;
}

/** Centroide del polígono (fórmula del área); si degenera, la media de los vértices. */
export function centroide(puntos: [number, number][]): [number, number] {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < puntos.length - 1; i++) {
    const [y0, x0] = puntos[i];
    const [y1, x1] = puntos[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-14) {
    const lat = puntos.reduce((s, p) => s + p[0], 0) / Math.max(1, puntos.length);
    const lng = puntos.reduce((s, p) => s + p[1], 0) / Math.max(1, puntos.length);
    return [lat, lng];
  }
  return [cy / (3 * a), cx / (3 * a)];
}

/** Parsea la respuesta del WFS BU. Una entrada por parcela (si hay varias, se suman superficies). */
export function parsearEdificios(gml: string): { edificios: EdificioMapa[]; posibleCorte: boolean } {
  const porRef = new Map<string, EdificioMapa>();
  for (const m of miembros(gml)) {
    if (!/<bu-ext2d:Building\b/i.test(m)) continue;
    const ref = (texto(m, "bu-core2d:reference") ?? texto(m, "base:localId") ?? "").replace(/\s/g, "").slice(0, 14);
    if (ref.length !== 14) continue;
    const pos = m.match(/<gml:posList[^>]*>([^<]+)<\/gml:posList>/i)?.[1] ?? "";
    const huella = anillo(pos);
    if (huella.length < 3) continue;
    const [lat, lng] = centroide(huella);
    const comienzo = texto(m, "bu-core2d:beginning");
    const anio = comienzo && /^\d{4}/.test(comienzo) ? Number(comienzo.slice(0, 4)) : null;
    const nuevo: EdificioMapa = {
      ref,
      uso: usoDesdeInspire(texto(m, "bu-ext2d:currentUse")),
      anio: anio && anio > 1000 ? anio : null,
      inmuebles: entero(texto(m, "bu-ext2d:numberOfBuildingUnits")),
      viviendas: entero(texto(m, "bu-ext2d:numberOfDwellings")),
      plantas: entero(texto(m, "bu-ext2d:numberOfFloorsAboveGround")),
      superficie: entero(texto(m, "bu-ext2d:value")),
      estado: texto(m, "bu-core2d:conditionOfConstruction"),
      lat,
      lng,
      huella,
      fotoUrl: `https://ovc.catastro.meh.es/OVCServWeb/OVCWcfLibres/OVCFotoFachada.svc/RecuperarFotoFachadaGet?ReferenciaCatastral=${ref}`,
      direcciones: [],
    };
    const previo = porRef.get(ref);
    if (!previo) {
      porRef.set(ref, nuevo);
    } else {
      previo.superficie = (previo.superficie ?? 0) + (nuevo.superficie ?? 0) || null;
      previo.inmuebles = Math.max(previo.inmuebles ?? 0, nuevo.inmuebles ?? 0) || previo.inmuebles;
    }
  }
  const edificios = [...porRef.values()];
  return { edificios, posibleCorte: edificios.length >= 5000 };
}

/** Parsea la respuesta del WFS AD: portales con su parcela, vía y código postal. */
export function parsearPortales(gml: string): Map<string, DireccionPortal[]> {
  const vias = new Map<string, string>();
  const ms = miembros(gml);
  for (const m of ms) {
    const id = m.match(/<ad:ThoroughfareName gml:id="([^"]+)"/i)?.[1];
    const nombre = texto(m, "gn:text");
    if (id && nombre) vias.set(id, nombre);
  }
  const porRef = new Map<string, DireccionPortal[]>();
  for (const m of ms) {
    if (!/<ad:Address\b/i.test(m)) continue;
    const localId = texto(m, "base:localId") ?? "";
    const ref = localId.match(/\b(\d{7}[A-Z0-9]{7})\b/)?.[1];
    const numero = m.match(/<ad:LocatorDesignator>[\s\S]*?<ad:designator>([^<]*)<\/ad:designator>/i)?.[1]?.trim();
    const pos = texto(m, "gml:pos")?.split(/\s+/).map(Number);
    if (!ref || !numero || !pos || pos.length < 2) continue;
    const tn = m.match(/xlink:href="#(ES\.SDGC\.TN\.[^"]+)"/i)?.[1];
    const cp = m.match(/xlink:href="#ES\.SDGC\.PD\.[^"]*?\.(\d{5})"/i)?.[1] ?? null;
    const lista = porRef.get(ref) ?? [];
    lista.push({ via: (tn && vias.get(tn)) || "", numero, codigoPostal: cp, lat: pos[0], lng: pos[1] });
    porRef.set(ref, lista);
  }
  return porRef;
}

/** Une portales a sus edificios. */
export function unirPortales(edificios: EdificioMapa[], portales: Map<string, DireccionPortal[]>): EdificioMapa[] {
  return edificios.map((e) => ({ ...e, direcciones: portales.get(e.ref) ?? [] }));
}

/** "CL RIEGO DE AGUA" → "Calle Riego de Agua". */
const TIPOS_VIA: Record<string, string> = {
  CL: "Calle", AV: "Avenida", PZ: "Plaza", PS: "Paseo", CR: "Carretera", RD: "Ronda", TR: "Travesía",
  CM: "Camino", GL: "Glorieta", LG: "Lugar", UR: "Urbanización", PJ: "Pasaje", BO: "Barrio", CJ: "Callejón",
  RU: "Rúa", CT: "Cuesta", AL: "Alameda", PQ: "Parque", BL: "Bloque", SD: "Senda",
};
const MINUSCULAS = new Set(["de", "del", "la", "las", "el", "los", "y", "do", "da", "dos", "das", "a", "o", "en"]);

export function nombreVia(via: string): string {
  const partes = via.trim().split(/\s+/);
  if (!partes[0]) return "";
  const tipo = TIPOS_VIA[partes[0].toUpperCase()];
  const resto = (tipo ? partes.slice(1) : partes).map((p, i) => {
    const l = p.toLowerCase();
    if ((tipo || i > 0) && MINUSCULAS.has(l)) return l;
    return l.charAt(0).toUpperCase() + l.slice(1);
  });
  return [tipo, ...resto].filter(Boolean).join(" ");
}

/** Dirección principal del edificio ("Plaza Maria Pita, 12") o la referencia si no hay portal. */
export function direccionPrincipal(e: Pick<EdificioMapa, "ref" | "direcciones">): string {
  const d = e.direcciones[0];
  if (!d || !d.via) return e.ref;
  return `${nombreVia(d.via)}, ${d.numero}`;
}

/** Inmueble de un edificio (Catastro DNPRC por parcela). */
export interface InmuebleEdificio {
  ref: string;
  planta: string | null;
  puerta: string | null;
  escalera: string | null;
  uso: string | null;
  superficie: number | null;
}

/** "Esc. 1 · Planta 02 · Puerta A". */
export function etiquetaInmueble(i: Pick<InmuebleEdificio, "planta" | "puerta" | "escalera">): string {
  const partes = [
    i.escalera ? `Esc. ${i.escalera}` : null,
    i.planta ? (/^\d+$/.test(i.planta) ? `Planta ${i.planta}` : i.planta) : null,
    i.puerta ? `Puerta ${i.puerta}` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Inmueble";
}

/** Si el mapa abarca más de lo que el WFS acepta, pide solo el centro (y lo dice). */
export function recortarRecuadro(r: Recuadro): { recuadro: Recuadro; recortado: boolean } {
  const altoMax = LADO_MAX_GRADOS * 0.98;
  const anchoMax = LADO_MAX_GRADOS * 1.4 * 0.98;
  const alto = r.norte - r.sur;
  const ancho = r.este - r.oeste;
  if (alto <= altoMax && ancho <= anchoMax) return { recuadro: r, recortado: false };
  const cLat = (r.norte + r.sur) / 2;
  const cLng = (r.este + r.oeste) / 2;
  const a = Math.min(alto, altoMax) / 2;
  const b = Math.min(ancho, anchoMax) / 2;
  return { recuadro: { sur: cLat - a, oeste: cLng - b, norte: cLat + a, este: cLng + b }, recortado: true };
}

export function textoRecuadro(r: Recuadro): string {
  return [r.sur, r.oeste, r.norte, r.este].map((v) => v.toFixed(5)).join(",");
}
