import type { OperacionMercado } from "./card";

export type SlugsMercado = {
  fotocasa?: string;
  habitaclia?: string;
  pisos?: string;
};

const DEFAULT: SlugsMercado = {
  fotocasa: "a-coruna-capital",
  habitaclia: "a-coruna-provincia/a-coruna-capital",
  pisos: "a_coruna_capital",
};

export function urlListadoFotocasa(operation: OperacionMercado, pagina: number, slugs?: SlugsMercado): string {
  const slug = slugs?.fotocasa ?? DEFAULT.fotocasa!;
  const op = operation === "rent" ? "alquiler" : "comprar";
  const base = `https://www.fotocasa.es/es/${op}/viviendas/${slug}/todas-las-zonas/l`;
  return pagina <= 1 ? base : `${base}/${pagina}?sortType=price&sortOrderDesc=false`;
}

export function urlListadoHabitaclia(
  operation: OperacionMercado,
  kind: "viviendas" | "casas",
  pagina: number,
  slugs?: SlugsMercado,
): string {
  const slug = slugs?.habitaclia ?? DEFAULT.habitaclia!;
  const op = operation === "rent" ? "alquiler" : "comprar";
  const base = `https://www.habitaclia.com/${op}/${kind}/${slug}/s`;
  return pagina <= 1 ? base : `${base}/${pagina}?sortBy=PRICE_ASC`;
}

export function urlListadoPisos(
  operation: OperacionMercado,
  kind: "piso" | "casas",
  pagina: number,
  slugs?: SlugsMercado,
): string {
  const slug = slugs?.pisos ?? DEFAULT.pisos!;
  const op = operation === "rent" ? "alquiler" : "venta";
  const base = `https://www.pisos.com/${op}/${kind}-${slug}/asc/`;
  return pagina <= 1 ? base : `${base}${pagina}/`;
}

export function slugsDesdePortalMap(map: Map<string, { slug: string }>): SlugsMercado {
  return {
    fotocasa: map.get("fotocasa")?.slug,
    habitaclia: map.get("habitaclia")?.slug,
    pisos: map.get("pisos")?.slug,
  };
}
