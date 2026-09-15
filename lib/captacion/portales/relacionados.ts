export type AnuncioRelacionable = {
  id: string;
  contacto_clave: string | null;
  municipio: string | null;
  tipo: string | null;
  operacion: "venta" | "alquiler";
  descripcion: string | null;
  titulo: string;
  precio: number | null;
  zona: string | null;
  thumb: string | null;
};

export type AvisoEncubierta = "ninguno" | "posible" | "probable";

export type IndiciosEncubierta = {
  n: number;
  aviso: AvisoEncubierta;
  lineas: string[];
};

const JERGA_AGENCIA =
  /disponemos de|oportunidad de inversi[oó]n|honorarios|sin comisi[oó]n|ideal inversores|ofrecemos|nuestro equipo|contamos con|llame a nuestra/i;

export function recuentoPorClave(anuncios: Array<{ contacto_clave: string | null }>): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of anuncios) {
    if (!a.contacto_clave) continue;
    map.set(a.contacto_clave, (map.get(a.contacto_clave) ?? 0) + 1);
  }
  return map;
}

export function relacionadosDe<T extends AnuncioRelacionable>(anuncio: T, todos: T[]): T[] {
  if (!anuncio.contacto_clave) return [];
  return todos.filter((a) => a.id !== anuncio.id && a.contacto_clave === anuncio.contacto_clave);
}

export function textoPareceAgencia(descripcion: string | null | undefined): boolean {
  return Boolean(descripcion && JERGA_AGENCIA.test(descripcion));
}

function listaEn(nombres: string[]): string {
  if (nombres.length === 1) return nombres[0];
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

function mezclaTipos(tipos: string[]): boolean {
  const set = new Set(tipos);
  if (set.size >= 3) return true;
  return set.size >= 2 && [...set].some((t) => t === "local" || t === "terreno" || t === "edificio");
}

export function indiciosEncubierta(grupo: AnuncioRelacionable[]): IndiciosEncubierta {
  const n = grupo.length;
  if (n < 3) return { n, aviso: "ninguno", lineas: [] };

  const municipios = [...new Set(grupo.map((a) => a.municipio?.trim()).filter((m): m is string => Boolean(m)))];
  const operaciones = new Set(grupo.map((a) => a.operacion));
  const tipos = grupo.map((a) => a.tipo).filter((t): t is string => Boolean(t));
  const lineas: string[] = [];
  if (municipios.length >= 2) lineas.push(`También anuncia en ${listaEn(municipios)}`);
  if (operaciones.has("venta") && operaciones.has("alquiler")) lineas.push("Venta y alquiler");
  if (mezclaTipos(tipos)) lineas.push("Varios tipos de inmueble");
  if (grupo.some((a) => textoPareceAgencia(a.descripcion))) lineas.push("El texto parece de agencia");

  const aviso: AvisoEncubierta = n >= 5 || lineas.length > 0 ? "probable" : "posible";
  return { n, aviso, lineas };
}

export function textoAvisoEncubierta(indicios: IndiciosEncubierta): string | null {
  if (indicios.aviso === "ninguno") return null;
  const base =
    indicios.aviso === "probable"
      ? `Este contacto aparece en ${indicios.n} anuncios. Probable profesional.`
      : `Este teléfono aparece en ${indicios.n} anuncios. Puede ser un profesional encubierto.`;
  return indicios.lineas.length ? `${base} ${indicios.lineas.join(". ")}.` : base;
}
