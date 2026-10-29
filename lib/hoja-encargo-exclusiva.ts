import { EMPRESA_DOCUMENTOS } from "./empresa-documentos";
import { parseClausulasPersonalizadas, type ClausulasPersonalizadasArras } from "./contrato-arras";

export type ClausulaExclusivaKey =
  | "encabezado"
  | "intro"
  | "exclusiva"
  | "honorarios"
  | "precio"
  | "reparto"
  | "lopd"
  | "cierre";

export type ClausulasPersonalizadasExclusiva = Partial<Record<ClausulaExclusivaKey, string>>;

export type HojaEncargoExclusivaDatos = {
  lugar: string;
  fecha: string | null;
  cliente_nombre: string;
  cliente_dni: string;
  cliente_calidad: string;
  inmueble_descripcion: string;
  plazo_meses: number;
  precio_venta: number | null;
  honorarios_porcentaje: number;
  honorarios_minimo: number;
  reparto_propiedad_pct: number;
  reparto_agencia_pct: number;
  clausulas_personalizadas: ClausulasPersonalizadasExclusiva;
};

export function hojaEncargoExclusivaVacia(): HojaEncargoExclusivaDatos {
  return {
    lugar: EMPRESA_DOCUMENTOS.lugar,
    fecha: null,
    cliente_nombre: "",
    cliente_dni: "",
    cliente_calidad: "propietario/a",
    inmueble_descripcion: "",
    plazo_meses: 6,
    precio_venta: null,
    honorarios_porcentaje: 3,
    honorarios_minimo: 3000,
    reparto_propiedad_pct: 60,
    reparto_agencia_pct: 40,
    clausulas_personalizadas: {},
  };
}

export function parseClausulasExclusiva(value: unknown): ClausulasPersonalizadasExclusiva {
  return parseClausulasPersonalizadas(value) as ClausulasPersonalizadasExclusiva;
}

export function hojaEncargoExclusivaDesdeFila(row: {
  lugar: string;
  fecha: string | null;
  cliente_nombre: string | null;
  cliente_dni: string | null;
  cliente_calidad: string | null;
  inmueble_descripcion: string | null;
  plazo_meses: number | string | null;
  precio_venta: number | string | null;
  honorarios_porcentaje: number | string | null;
  honorarios_minimo: number | string | null;
  reparto_propiedad_pct: number | string | null;
  reparto_agencia_pct: number | string | null;
  clausulas_personalizadas?: unknown;
}): HojaEncargoExclusivaDatos {
  return {
    lugar: row.lugar || EMPRESA_DOCUMENTOS.lugar,
    fecha: row.fecha,
    cliente_nombre: row.cliente_nombre ?? "",
    cliente_dni: row.cliente_dni ?? "",
    cliente_calidad: row.cliente_calidad ?? "propietario/a",
    inmueble_descripcion: row.inmueble_descripcion ?? "",
    plazo_meses: row.plazo_meses == null ? 6 : Number(row.plazo_meses),
    precio_venta: row.precio_venta == null || row.precio_venta === "" ? null : Number(row.precio_venta),
    honorarios_porcentaje: row.honorarios_porcentaje == null ? 3 : Number(row.honorarios_porcentaje),
    honorarios_minimo: row.honorarios_minimo == null ? 3000 : Number(row.honorarios_minimo),
    reparto_propiedad_pct: row.reparto_propiedad_pct == null ? 60 : Number(row.reparto_propiedad_pct),
    reparto_agencia_pct: row.reparto_agencia_pct == null ? 40 : Number(row.reparto_agencia_pct),
    clausulas_personalizadas: parseClausulasExclusiva(row.clausulas_personalizadas),
  };
}

/** Compatibilidad tipada con el preview editable genérico. */
export type ClausulasPreview = ClausulasPersonalizadasArras;
