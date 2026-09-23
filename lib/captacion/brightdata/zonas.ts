export type ZonaIdealista = {
  id: string;
  grupo: string;
  nombre: string;
  anuncios: number;
  url: string;
};

/** Viviendas en venta que entran en los 5.000 créditos de la primera pasada. Cifras de Idealista, 23 sep 2026. */
export const ZONAS_IDEALISTA: ZonaIdealista[] = [
  { id: "coruna", grupo: "Área de A Coruña", nombre: "A Coruña", anuncios: 902, url: "https://www.idealista.com/venta-viviendas/a-coruna-a-coruna/" },
  { id: "oleiros", grupo: "Área de A Coruña", nombre: "Oleiros", anuncios: 392, url: "https://www.idealista.com/venta-viviendas/oleiros-a-coruna/" },
  { id: "arteixo", grupo: "Área de A Coruña", nombre: "Arteixo", anuncios: 159, url: "https://www.idealista.com/venta-viviendas/arteixo-a-coruna/" },
  { id: "culleredo", grupo: "Área de A Coruña", nombre: "Culleredo", anuncios: 145, url: "https://www.idealista.com/venta-viviendas/culleredo-a-coruna/" },
  { id: "sada", grupo: "Área de A Coruña", nombre: "Sada", anuncios: 145, url: "https://www.idealista.com/venta-viviendas/sada-a-coruna/" },
  { id: "bergondo", grupo: "Área de A Coruña", nombre: "Bergondo", anuncios: 128, url: "https://www.idealista.com/venta-viviendas/bergondo-a-coruna/" },
  { id: "cambre", grupo: "Área de A Coruña", nombre: "Cambre", anuncios: 101, url: "https://www.idealista.com/venta-viviendas/cambre-a-coruna/" },
  { id: "carral", grupo: "Área de A Coruña", nombre: "Carral", anuncios: 62, url: "https://www.idealista.com/venta-viviendas/carral-a-coruna/" },
  { id: "abegondo", grupo: "Área de A Coruña", nombre: "Abegondo", anuncios: 56, url: "https://www.idealista.com/venta-viviendas/abegondo-a-coruna/" },
  { id: "santiago", grupo: "Santiago", nombre: "Santiago y alrededores", anuncios: 1069, url: "https://www.idealista.com/venta-viviendas/a-coruna/santiago/" },
  { id: "ferrol", grupo: "Ferrol", nombre: "Ferrol", anuncios: 667, url: "https://www.idealista.com/venta-viviendas/ferrol-a-coruna/" },
  { id: "naron", grupo: "Ferrol", nombre: "Narón", anuncios: 377, url: "https://www.idealista.com/venta-viviendas/naron-a-coruna/" },
  { id: "ribeira", grupo: "Barbanza", nombre: "Ribeira", anuncios: 252, url: "https://www.idealista.com/venta-viviendas/ribeira-a-coruna/" },
  { id: "boiro", grupo: "Barbanza", nombre: "Boiro", anuncios: 134, url: "https://www.idealista.com/venta-viviendas/boiro-a-coruna/" },
];

/** Filtro de particulares de Idealista: segmento de ruta `/con-particulares/`, no un query param. */
export function urlParticularesIdealista(url: string): string {
  if (url.includes("/con-particulares/")) return url;
  return `${url.replace(/\/$/, "")}/con-particulares/`;
}

const POR_ID = new Map(ZONAS_IDEALISTA.map((zona) => [zona.id, zona]));

/** Compara municipio/zona del anuncio con el catálogo (A Coruña, Santiago, …). */
export function idsZonaDeAnuncio(municipio: string | null | undefined, zona: string | null | undefined): string[] {
  const blob = `${municipio ?? ""} ${zona ?? ""}`
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

/** URLs de listado que se envían a Bright Data. Sin ids, usa el catálogo entero. */
export function urlsDeZonas(ids: string[]): string[] {
  const elegidas = ids.length > 0 ? ids : ZONAS_IDEALISTA.map((zona) => zona.id);
  const urls: string[] = [];
  const vistas = new Set<string>();
  for (const id of elegidas) {
    const zona = POR_ID.get(id);
    if (!zona) continue;
    const url = urlParticularesIdealista(zona.url);
    if (vistas.has(url)) continue;
    vistas.add(url);
    urls.push(url);
  }
  return urls;
}

export function anunciosDeZonas(ids: string[]): number {
  return ids.reduce((suma, id) => suma + (POR_ID.get(id)?.anuncios ?? 0), 0);
}
