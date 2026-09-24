export type OperacionZona = "venta" | "alquiler";

export const ZONA_DESCONOCIDA = "desconocida";

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

function distrito(grupo: string, ciudadBase: string, nombre: string, anuncios = 0): ZonaIdealista {
  const trozo = slug(nombre);
  return {
    id: `${slug(grupo)}-${trozo}`,
    grupo,
    nombre,
    anuncios,
    porDefecto: false,
    operacion: "venta",
    url: `https://www.idealista.com/venta-viviendas/${ciudadBase}/${trozo}/`,
  };
}

const DISTRITOS_CORUNA: Array<[string, number]> = [
  ["Agra del Orzán - Ventorrillo", 68],
  ["Ciudad Vieja - Centro", 63],
  ["Cuatro Caminos - Plaza de la Cubela", 50],
  ["Eirís", 53],
  ["Elviña - A Zapateira", 26],
  ["Ensanche - Juan Flórez", 172],
  ["Los Castros - Castrillón", 70],
  ["Los Rosales", 33],
  ["Mesoiro", 29],
  ["Monte Alto - Zalaeta - Atocha", 109],
  ["Os Mallos", 44],
  ["Riazor - Visma", 58],
  ["Sagrada Familia", 35],
  ["Someso - Matogrande", 87],
  ["Vioño", 5],
];

const DISTRITOS_SANTIAGO = [
  "Centro",
  "Ensanche",
  "Campus Norte",
  "Campus Sur",
  "San Pedro",
  "Santa Marta",
  "Conxo",
  "Vite",
  "Castiñeiriño",
  "Fontiñas",
  "Salgueiriños",
];

const DISTRITOS_FERROL = ["Centro", "Recimil", "Caranza", "Esteiro", "Canido", "O Pilar", "San Juan"];

const MUNICIPIOS_DEFECTO: Array<[string, number, string]> = [
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
  ...DISTRITOS_CORUNA.map(([nombre, anuncios]) => distrito("A Coruña", "a-coruna", nombre, anuncios)),
  ...DISTRITOS_SANTIAGO.map((nombre) => distrito("Santiago", "a-coruna/santiago", nombre)),
  ...DISTRITOS_FERROL.map((nombre) => distrito("Ferrol", "ferrol-a-coruna", nombre)),
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

export function urlsDeZonas(ids: string[], operacion: Record<string, OperacionZona> = {}): string[] {
  const elegidas = ids.length > 0 ? ids : ZONAS_IDEALISTA.filter((zona) => zona.porDefecto).map((zona) => zona.id);
  const urls: string[] = [];
  const vistas = new Set<string>();
  for (const id of elegidas) {
    const zona = POR_ID.get(id);
    if (!zona) continue;
    const url = urlParticularesIdealista(urlSegunOperacion(zona.url, operacion[id] ?? zona.operacion));
    if (vistas.has(url)) continue;
    vistas.add(url);
    urls.push(url);
  }
  return urls;
}

export function urlParticularesIdealista(url: string): string {
  if (url.includes("/con-particulares/")) return url;
  return `${url.replace(/\/$/, "")}/con-particulares/`;
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
  return typeof zonaId === "string" && zonaId !== ZONA_DESCONOCIDA && zonas.includes(zonaId);
}

/** Puntos aproximados para partir una sola vez coruna/santiago/ferrol. La recogida siguiente los sustituye. */
const CENTROS: Record<"coruna" | "santiago" | "ferrol", Array<{ id: string; lat: number; lng: number }>> = {
  coruna: [
    ["a-coruna-ciudad-vieja-centro", 43.3705, -8.3958],
    ["a-coruna-ensanche-juan-florez", 43.3672, -8.4068],
    ["a-coruna-riazor-visma", 43.3692, -8.4125],
    ["a-coruna-monte-alto-zalaeta-atocha", 43.374, -8.397],
    ["a-coruna-los-castros-castrillon", 43.353, -8.41],
    ["a-coruna-agra-del-orzan-ventorrillo", 43.356, -8.419],
    ["a-coruna-someso-matogrande", 43.347, -8.404],
    ["a-coruna-eiris", 43.348, -8.39],
    ["a-coruna-cuatro-caminos-plaza-de-la-cubela", 43.36, -8.401],
    ["a-coruna-os-mallos", 43.347, -8.418],
    ["a-coruna-sagrada-familia", 43.358, -8.397],
    ["a-coruna-los-rosales", 43.344, -8.4],
    ["a-coruna-mesoiro", 43.339, -8.412],
    ["a-coruna-elvina-a-zapateira", 43.333, -8.41],
    ["a-coruna-viono", 43.363, -8.422],
  ].map(([id, lat, lng]) => ({ id: String(id), lat: Number(lat), lng: Number(lng) })),
  santiago: [
    ["santiago-centro", 42.8805, -8.544],
    ["santiago-ensanche", 42.876, -8.54],
    ["santiago-campus-norte", 42.886, -8.555],
    ["santiago-campus-sur", 42.874, -8.555],
    ["santiago-san-pedro", 42.883, -8.535],
    ["santiago-santa-marta", 42.887, -8.545],
    ["santiago-conxo", 42.868, -8.54],
    ["santiago-vite", 42.865, -8.53],
    ["santiago-castineirino", 42.862, -8.52],
    ["santiago-fontinas", 42.89, -8.52],
    ["santiago-salgueirinos", 42.892, -8.51],
  ].map(([id, lat, lng]) => ({ id: String(id), lat: Number(lat), lng: Number(lng) })),
  ferrol: [
    ["ferrol-centro", 43.483, -8.232],
    ["ferrol-recimil", 43.49, -8.225],
    ["ferrol-caranza", 43.478, -8.22],
    ["ferrol-esteiro", 43.486, -8.24],
    ["ferrol-canido", 43.478, -8.245],
    ["ferrol-o-pilar", 43.492, -8.235],
    ["ferrol-san-juan", 43.488, -8.218],
  ].map(([id, lat, lng]) => ({ id: String(id), lat: Number(lat), lng: Number(lng) })),
};

export function ciudadAntigua(municipio: string | null | undefined, zona: string | null | undefined): "coruna" | "santiago" | "ferrol" | null {
  const blob = `${municipio ?? ""} ${zona ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/santiago/.test(blob)) return "santiago";
  if (/ferrol/.test(blob)) return "ferrol";
  if (/coruna/.test(blob) && !/oleiros|arteixo|sada|cambre|culleredo/.test(blob)) return "coruna";
  return null;
}

export function distritoPorCoordenadas(
  ciudad: "coruna" | "santiago" | "ferrol",
  lat: number | null | undefined,
  lng: number | null | undefined
): string {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return ZONA_DESCONOCIDA;
  let mejor = CENTROS[ciudad][0];
  let dist = Infinity;
  for (const centro of CENTROS[ciudad]) {
    const d = (centro.lat - lat) ** 2 + (centro.lng - lng) ** 2;
    if (d < dist) {
      dist = d;
      mejor = centro;
    }
  }
  return mejor.id;
}
