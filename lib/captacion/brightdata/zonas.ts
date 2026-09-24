export type OperacionZona = "venta" | "alquiler";

export const ZONA_DESCONOCIDA = "desconocida";
/** Listado de provincia a 48 h. Fecha sí; retirados no. */
export const ZONA_PROVINCIA_48H = "provincia-48h";
export const URL_PROVINCIA_48H = "https://www.idealista.com/venta-viviendas/a-coruna-provincia/con-publicado_ultimas-48-horas/";

export type ZonaIdealista = {
  id: string;
  grupo: string;
  nombre: string;
  /** Cifra de Idealista. En Ajustes se puede sustituir por un estimado. */
  anuncios: number;
  /** Marcada al instalar. Las zonas nuevas de la provincia entran desmarcadas. */
  porDefecto: boolean;
  /** Por ahora el catálogo activo es venta. Alquiler se genera al activar la fila. */
  operacion: OperacionZona;
  url: string;
};

/** Idealista corta el listado al pasar de este número de anuncios. Hay que partir la zona. */
export const CORTE_IDEALISTA = 1500;

export function zonaSuperaCorte(estimado: number | null | undefined): boolean {
  return estimado != null && Number.isFinite(estimado) && estimado > CORTE_IDEALISTA;
}

function slug(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function municipio(nombre: string, anuncios = 0, porDefecto = false, url?: string): ZonaIdealista {
  const id = slug(nombre);
  return {
    id,
    grupo: "Provincia de A Coruña",
    nombre,
    anuncios,
    porDefecto,
    operacion: "venta",
    url: url ?? `https://www.idealista.com/venta-viviendas/${id}-a-coruna/`,
  };
}

const MUNICIPIOS_DEFECTO: Array<[string, number, string?]> = [
  ["A Coruña", 968],
  ["Santiago de Compostela", 502],
  ["Ferrol", 655],
  ["Oleiros", 392, "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/"],
  ["Arteixo", 159, "https://www.idealista.com/venta-viviendas/arteixo-a-coruna/"],
  ["Culleredo", 145, "https://www.idealista.com/venta-viviendas/culleredo-a-coruna/"],
  ["Sada", 145, "https://www.idealista.com/venta-viviendas/sada-a-coruna/"],
  ["Bergondo", 128, "https://www.idealista.com/venta-viviendas/bergondo-a-coruna/"],
  ["Cambre", 101, "https://www.idealista.com/venta-viviendas/cambre-a-coruna/"],
  ["Carral", 62, "https://www.idealista.com/venta-viviendas/carral-a-coruna/"],
  ["Abegondo", 56, "https://www.idealista.com/venta-viviendas/abegondo-a-coruna/"],
  ["Narón", 377, "https://www.idealista.com/venta-viviendas/naron-a-coruna/"],
  ["Ribeira", 252, "https://www.idealista.com/venta-viviendas/ribeira-a-coruna/"],
  ["Boiro", 134, "https://www.idealista.com/venta-viviendas/boiro-a-coruna/"],
];

const MUNICIPIOS_NUEVOS = [
  "Ames", "Aranga", "Ares", "Arzúa", "A Baña", "Betanzos", "Boimorto", "Boqueixón", "Brión",
  "Cabana de Bergantiños", "Cabanas", "Camariñas", "A Capela", "Carballo", "Cariño", "Carnota",
  "Cedeira", "Cee", "Cerceda", "Cerdido", "Coirós", "Corcubión", "Coristanco", "Curtis", "Dodro",
  "Dumbría", "Fene", "Fisterra", "Frades", "Irixoa", "A Laracha", "Laxe", "Lousame",
  "Malpica de Bergantiños", "Mañón", "Mazaricos", "Melide", "Mesía", "Miño", "Moeche", "Monfero",
  "Mugardos", "Muros", "Muxía", "Neda", "Negreira", "Noia", "Ordes", "Oroso", "Ortigueira", "Outes",
  "Oza-Cesuras", "Paderne", "Padrón", "O Pino", "A Pobra do Caramiñal", "Ponteceso", "Pontedeume",
  "As Pontes de García Rodríguez", "Porto do Son", "Rianxo", "Rois", "San Sadurniño", "Santa Comba",
  "Santiso", "Sobrado", "As Somozas", "Teo", "Toques", "Tordoia", "Touro", "Trazo", "Val do Dubra",
  "Valdoviño", "Vedra", "Vilarmaior", "Vilasantar", "Vimianzo", "Zas",
];

export const ZONAS_IDEALISTA: ZonaIdealista[] = [
  ...MUNICIPIOS_DEFECTO.map(([nombre, anuncios, url]) => municipio(nombre, anuncios, true, url)),
  ...MUNICIPIOS_NUEVOS.map((nombre) => municipio(nombre)),
];

const POR_ID = new Map(ZONAS_IDEALISTA.map((zona) => [zona.id, zona]));

export function idsZonaDeAnuncio(municipioNombre: string | null | undefined, zona: string | null | undefined): string[] {
  const blob = `${municipioNombre ?? ""} ${zona ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return ZONAS_IDEALISTA.filter((item) => {
    const nombre = item.nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+y alrededores$/, "");
    const token = nombre.startsWith("a ") ? nombre.slice(2) : nombre;
    return token.length > 2 && blob.includes(token);
  }).map((item) => item.id);
}

export function esZonaIdealista(id: string): boolean {
  return POR_ID.has(id);
}

export function paresDeZonas(ids: string[], operacion: Record<string, OperacionZona> = {}): Array<{ zona_id: string; url: string }> {
  const elegidas = ids.length > 0 ? ids : ZONAS_IDEALISTA.filter((zona) => zona.porDefecto).map((zona) => zona.id);
  const pares: Array<{ zona_id: string; url: string }> = [];
  const vistas = new Set<string>();
  for (const id of elegidas) {
    const zona = POR_ID.get(id);
    if (!zona) continue;
    const url = urlSegunOperacion(zona.url, operacion[id] ?? zona.operacion);
    if (vistas.has(url)) continue;
    vistas.add(url);
    pares.push({ zona_id: zona.id, url });
  }
  return pares;
}

export function urlsDeZonas(ids: string[], operacion: Record<string, OperacionZona> = {}): string[] {
  return paresDeZonas(ids, operacion).map((par) => par.url);
}

export function urlParticularesIdealista(url: string): string {
  return url.replace(/\/con-particulares\/?/, "/");
}

export function anunciosDeZonas(ids: string[]): number {
  return ids.reduce((suma, id) => suma + (POR_ID.get(id)?.anuncios ?? 0), 0);
}

export function zonasPorDefecto(): string[] {
  return ZONAS_IDEALISTA.filter((zona) => zona.porDefecto).map((zona) => zona.id);
}

export function urlSegunOperacion(url: string, operacion: OperacionZona): string {
  if (operacion === "alquiler") return url.replace("/venta-viviendas/", "/alquiler-viviendas/");
  return url;
}

/** Zona del listado en el que se vio el anuncio. La más específica gana. */
export function zonaIdDeListado(url: string | null | undefined): string | null {
  if (!url) return null;
  const path = url.replace(/^https?:\/\/(www\.)?idealista\.com/i, "").replace(/\/con-[^/]*\/?$/, "/");
  let mejor: { id: string; n: number } | null = null;
  for (const zona of ZONAS_IDEALISTA) {
    const base = zona.url.replace(/^https?:\/\/(www\.)?idealista\.com/i, "");
    if (path.includes(base.replace(/\/$/, "")) && (!mejor || base.length > mejor.n)) mejor = { id: zona.id, n: base.length };
  }
  return mejor?.id ?? null;
}

export function entraEnRetirados(zonaId: string | null | undefined, zonas: string[]): boolean {
  return typeof zonaId === "string" && zonaId !== ZONA_DESCONOCIDA && zonaId !== ZONA_PROVINCIA_48H && zonas.includes(zonaId);
}

