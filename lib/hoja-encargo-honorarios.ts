import { EMPRESA_DOCUMENTOS } from "./empresa-documentos";
import { parseClausulasPersonalizadas, type ClausulasPersonalizadasArras } from "./contrato-arras";

export type ClausulaHonorariosKey =
  | "encabezado"
  | "intro"
  | "honorarios"
  | "reparto"
  | "lopd"
  | "cierre";

export type ClausulasPersonalizadasHonorarios = Partial<Record<ClausulaHonorariosKey, string>>;

export type HojaEncargoHonorariosDatos = {
  lugar: string;
  fecha: string | null;
  cliente_nombre: string;
  cliente_dni: string;
  cliente_calidad: string;
  inmueble_descripcion: string;
  honorarios_porcentaje: number;
  honorarios_minimo: number;
  reparto_propiedad_pct: number;
  reparto_agencia_pct: number;
  clausulas_personalizadas: ClausulasPersonalizadasHonorarios;
};

export function hojaEncargoHonorariosVacia(): HojaEncargoHonorariosDatos {
  return {
    lugar: EMPRESA_DOCUMENTOS.lugar,
    fecha: null,
    cliente_nombre: "",
    cliente_dni: "",
    cliente_calidad: "propietario/a",
    inmueble_descripcion: "",
    honorarios_porcentaje: 3,
    honorarios_minimo: 3000,
    reparto_propiedad_pct: 60,
    reparto_agencia_pct: 40,
    clausulas_personalizadas: {},
  };
}

export function parseClausulasHonorarios(value: unknown): ClausulasPersonalizadasHonorarios {
  return parseClausulasPersonalizadas(value) as ClausulasPersonalizadasHonorarios;
}

export function hojaEncargoDesdeFila(row: {
  lugar: string;
  fecha: string | null;
  cliente_nombre: string | null;
  cliente_dni: string | null;
  cliente_calidad: string | null;
  inmueble_descripcion: string | null;
  honorarios_porcentaje: number | string | null;
  honorarios_minimo: number | string | null;
  reparto_propiedad_pct: number | string | null;
  reparto_agencia_pct: number | string | null;
  clausulas_personalizadas?: unknown;
}): HojaEncargoHonorariosDatos {
  return {
    lugar: row.lugar || EMPRESA_DOCUMENTOS.lugar,
    fecha: row.fecha,
    cliente_nombre: row.cliente_nombre ?? "",
    cliente_dni: row.cliente_dni ?? "",
    cliente_calidad: row.cliente_calidad ?? "propietario/a",
    inmueble_descripcion: row.inmueble_descripcion ?? "",
    honorarios_porcentaje: row.honorarios_porcentaje == null ? 3 : Number(row.honorarios_porcentaje),
    honorarios_minimo: row.honorarios_minimo == null ? 3000 : Number(row.honorarios_minimo),
    reparto_propiedad_pct: row.reparto_propiedad_pct == null ? 60 : Number(row.reparto_propiedad_pct),
    reparto_agencia_pct: row.reparto_agencia_pct == null ? 40 : Number(row.reparto_agencia_pct),
    clausulas_personalizadas: parseClausulasHonorarios(row.clausulas_personalizadas),
  };
}

/** Compatibilidad tipada con el preview editable genérico. */
export type ClausulasPreview = ClausulasPersonalizadasArras;
