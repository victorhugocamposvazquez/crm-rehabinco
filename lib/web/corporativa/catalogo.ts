import { INMUEBLES_MOCK } from "./mock-inmuebles";
import type { InmuebleCorporativa, ModoCorporativa } from "./types";

const TIPO_LABEL: Record<string, string> = {
  piso: "Piso",
  atico: "Ático",
  bajo: "Bajo",
  chalet: "Casa",
  local: "Local",
  solar: "Terreno",
  garaje: "Garaje",
  nave: "Nave",
};

function modoDe(tipoOperacion: string | null | undefined, precioVenta: number | null, precioAlquiler: number | null): ModoCorporativa {
  if (tipoOperacion === "alquiler" && precioAlquiler && precioAlquiler > 0) return "alquiler";
  return "venta";
}

function tipoDe(raw: string | null | undefined): string {
  if (!raw) return "Inmueble";
  const key = raw.toLowerCase();
  return TIPO_LABEL[key] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
}

function numero(valor: unknown): number {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() && Number.isFinite(Number(valor))) return Number(valor);
  return 0;
}

export function inmuebleCrmDe(raw: Record<string, unknown>): InmuebleCorporativa | null {
  const referencia = typeof raw.referencia === "string" ? raw.referencia.trim() : "";
  if (!referencia) return null;
  const titulo =
    (typeof raw.titulo === "string" && raw.titulo.trim()) ||
    (typeof raw.direccion === "string" && raw.direccion.trim()) ||
    "Inmueble";
  const localidad = (typeof raw.localidad === "string" && raw.localidad.trim()) || "A Coruña";
  const precioVenta = numero(raw.precio_venta);
  const precioAlquiler = numero(raw.precio_alquiler);
  const modo = modoDe(typeof raw.tipo_operacion === "string" ? raw.tipo_operacion : null, precioVenta, precioAlquiler);
  const precio = modo === "alquiler" ? precioAlquiler || precioVenta : precioVenta || precioAlquiler;
  if (!precio) return null;
  const fotos = Array.isArray(raw.fotos)
    ? raw.fotos.filter((f): f is string => typeof f === "string" && f.trim().length > 0)
    : [];
  const fotoPrincipal = fotos[0] ?? "";
  const descripcion =
    (typeof raw.descripcion === "string" && raw.descripcion.trim()) ||
    "Consulta con Rehabinco para más detalles.";
  return {
    slug: referencia,
    origen: "crm",
    modo,
    tipo: tipoDe(typeof raw.tipo_inmueble === "string" ? raw.tipo_inmueble : null),
    titulo,
    zona: localidad,
    municipio: localidad.split("·").pop()?.trim() || localidad,
    precio,
    dormitorios: numero(raw.habitaciones),
    banos: numero(raw.banos),
    m2: Math.round(numero(raw.superficie_m2)),
    ref: referencia,
    extras: [],
    estadoLabel: "Disponible",
    fotoPrincipal,
    fotos: fotos.length ? fotos : fotoPrincipal ? [fotoPrincipal] : [],
    descripcion,
  };
}

/** Stock del CRM. Los mocks solo en preview local explícita (ver incluirMocks). */
export function combinarCatalogo(crm: InmuebleCorporativa[], incluirMocks = false): InmuebleCorporativa[] {
  if (!incluirMocks) return crm;
  const refsCrm = new Set(crm.map((item) => item.slug.toLowerCase()));
  const mocks = INMUEBLES_MOCK.filter((item) => !refsCrm.has(item.slug.toLowerCase()));
  return [...crm, ...mocks];
}

export function buscarInmueble(catalogo: InmuebleCorporativa[], slug: string): InmuebleCorporativa | null {
  const buscado = decodeURIComponent(slug).trim().toLowerCase();
  return catalogo.find((item) => item.slug.toLowerCase() === buscado) ?? null;
}

export function similares(catalogo: InmuebleCorporativa[], item: InmuebleCorporativa, limite = 3): InmuebleCorporativa[] {
  return catalogo
    .filter((otro) => otro.slug !== item.slug && otro.modo === item.modo)
    .slice(0, limite);
}

export function formatoPrecio(item: InmuebleCorporativa): string {
  const n = item.precio.toLocaleString("es-ES");
  return item.modo === "alquiler" ? `${n} €/mes` : `${n} €`;
}

export function specsCortas(item: InmuebleCorporativa): string {
  const partes: string[] = [];
  if (item.dormitorios) partes.push(`${item.dormitorios} dorm.`);
  if (item.banos) partes.push(`${item.banos} baño${item.banos === 1 ? "" : "s"}`);
  if (item.m2) partes.push(`${item.m2} m²`);
  return partes.join(" · ");
}
