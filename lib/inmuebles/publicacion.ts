import type { InmuebleFormValues } from "./catalogo";
import {
  esTerrenoIdealista,
  esViviendaIdealista,
  requiereCertificadoIdealista,
  tipoIdealistaEfectivo,
} from "./idealista";

/** Lo que Idealista rechaza en el volcado de vivienda, local y oficina. */
export const CERTIFICADOS_ENERGETICOS = ["A", "B", "C", "D", "E", "F", "G", "en_tramite", "exento"] as const;
export type CertificadoEnergetico = (typeof CERTIFICADOS_ENERGETICOS)[number];

export const CERTIFICADO_LABEL: Record<CertificadoEnergetico, string> = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  E: "E",
  F: "F",
  G: "G",
  en_tramite: "En trámite",
  exento: "Exento",
};

export type DatosPublicacion = {
  tipo_inmueble: string;
  idealista_tipo: string;
  idealista_visibilidad_direccion: string;
  tipo_operacion: InmuebleFormValues["tipo_operacion"];
  precio_venta: string;
  precio_alquiler: string;
  direccion: string;
  titulo: string;
  codigo_postal: string;
  localidad: string;
  superficie_m2: string;
  superficie_construida: string;
  superficie_parcela: string;
  habitaciones: string;
  banos: string;
  descripcion: string;
  certificado_energetico: string;
  fotos: number;
};

function numero(valor: string): number | null {
  const n = Number(valor);
  return valor.trim() && Number.isFinite(n) ? n : null;
}

function precioOk(datos: DatosPublicacion): boolean {
  const venta = numero(datos.precio_venta);
  const alquiler = numero(datos.precio_alquiler);
  if (datos.tipo_operacion === "alquiler") return alquiler != null && alquiler > 0;
  if (datos.tipo_operacion === "ambos") return venta != null && venta > 0 && alquiler != null && alquiler > 0;
  return venta != null && venta > 0;
}

function superficieOk(datos: DatosPublicacion): boolean {
  const tipoIdealista = tipoIdealistaEfectivo(datos.idealista_tipo, datos.tipo_inmueble);
  if (esTerrenoIdealista(tipoIdealista) || datos.tipo_inmueble === "solar") {
    const parcela = numero(datos.superficie_parcela) ?? numero(datos.superficie_m2);
    return parcela != null && parcela > 0;
  }
  const construida = numero(datos.superficie_construida) ?? numero(datos.superficie_m2);
  return construida != null && construida > 0;
}

export function faltasWeb(datos: DatosPublicacion): string[] {
  const faltas: string[] = [];
  if (!datos.titulo.trim() && !datos.direccion.trim()) faltas.push("título o dirección");
  if (!datos.localidad.trim()) faltas.push("localidad");
  if (!precioOk(datos)) faltas.push("precio");
  if (!datos.descripcion.trim()) faltas.push("descripción");
  return faltas;
}

/** Campos que el volcado de Idealista no acepta vacíos. */
export function faltasIdealista(datos: DatosPublicacion): string[] {
  const faltas: string[] = [];
  const tipoIdealista = tipoIdealistaEfectivo(datos.idealista_tipo, datos.tipo_inmueble);
  if (!tipoIdealista) faltas.push("tipo de vivienda (Idealista)");
  if (!datos.idealista_visibilidad_direccion.trim()) faltas.push("visibilidad en portales");
  if (!precioOk(datos)) faltas.push("precio");
  if (!datos.direccion.trim()) faltas.push("dirección");
  if (!/^\d{5}$/.test(datos.codigo_postal.trim())) faltas.push("código postal de 5 cifras");
  if (!datos.localidad.trim()) faltas.push("localidad");
  const terreno = esTerrenoIdealista(tipoIdealista) || datos.tipo_inmueble === "solar";
  if (!superficieOk(datos)) faltas.push(terreno ? "superficie de parcela" : "superficie construida");
  if (esViviendaIdealista(tipoIdealista)) {
    if (numero(datos.habitaciones) == null) faltas.push("habitaciones");
    const banos = numero(datos.banos);
    if (banos == null || banos < 1) faltas.push("baños");
  }
  if (datos.descripcion.trim().length < 50) faltas.push("descripción de al menos 50 caracteres");
  if (datos.fotos < 1) faltas.push("al menos una foto");
  if (requiereCertificadoIdealista(tipoIdealista) && !datos.certificado_energetico.trim()) {
    faltas.push("certificado energético");
  }
  return faltas;
}

export function avisoPublicacion(
  values: Pick<
    InmuebleFormValues,
    | "publicar_web"
    | "publicar_idealista"
    | "tipo_inmueble"
    | "tipo_operacion"
    | "precio_venta"
    | "precio_alquiler"
    | "direccion"
    | "titulo"
    | "codigo_postal"
    | "localidad"
    | "superficie_m2"
    | "superficie_construida"
    | "superficie_parcela"
    | "habitaciones"
    | "banos"
    | "descripcion"
    | "certificado_energetico"
    | "idealista_tipo"
    | "idealista_visibilidad_direccion"
  >,
  fotos: number
): string | null {
  const datos: DatosPublicacion = { ...values, fotos };
  const partes: string[] = [];
  if (values.publicar_web) {
    const faltas = faltasWeb(datos);
    if (faltas.length) partes.push(`Web: ${faltas.join(", ")}`);
  }
  if (values.publicar_idealista) {
    const faltas = faltasIdealista(datos);
    if (faltas.length) partes.push(`Idealista: ${faltas.join(", ")}`);
  }
  return partes.length ? `Para publicar falta ${partes.join(". ")}.` : null;
}
