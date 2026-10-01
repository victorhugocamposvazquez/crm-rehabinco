import { EMPRESA_DOCUMENTOS } from "./empresa-documentos";
import {
  parseClausulasPersonalizadas,
  parsePersonasArras,
  personaArrasVacia,
  type ClausulasPersonalizadasArras,
  type PersonaArras,
} from "./contrato-arras";

export type ClausulaPagoAplazadoKey =
  | "encabezado"
  | "reunidosVendedores"
  | "reunidosCompradores"
  | "intervienen"
  | "exponenI"
  | "exponenII"
  | "exponenIII"
  | "exponenIV"
  | "primera"
  | "segunda"
  | "tercera"
  | "cuarta"
  | "quinta"
  | "sexta"
  | "cierre";

export type ClausulasPersonalizadasPagoAplazado = Partial<Record<ClausulaPagoAplazadoKey, string>>;

export type ContratoPagoAplazadoDatos = {
  lugar: string;
  fecha: string | null;
  vendedores: PersonaArras[];
  compradores: PersonaArras[];
  finca_descripcion: string;
  titulo_adquisicion: string;
  precio: number | null;
  pago_inicial: number | null;
  cuota_mensual: number | null;
  cuota_desde: string;
  cuenta_vendedora: string;
  plazo_escritura: string;
  plazo_posesion: string;
  penalizacion_mensual: number | null;
  clausulas_personalizadas: ClausulasPersonalizadasPagoAplazado;
};

export function contratoPagoAplazadoVacio(): ContratoPagoAplazadoDatos {
  return {
    lugar: EMPRESA_DOCUMENTOS.lugar,
    fecha: null,
    vendedores: [personaArrasVacia("Don")],
    compradores: [personaArrasVacia("Don")],
    finca_descripcion: "",
    titulo_adquisicion: "",
    precio: null,
    pago_inicial: null,
    cuota_mensual: null,
    cuota_desde: "",
    cuenta_vendedora: "",
    plazo_escritura: "",
    plazo_posesion: "",
    penalizacion_mensual: null,
    clausulas_personalizadas: {},
  };
}

export function parseClausulasPagoAplazado(value: unknown): ClausulasPersonalizadasPagoAplazado {
  return parseClausulasPersonalizadas(value) as ClausulasPersonalizadasPagoAplazado;
}

export function contratoPagoAplazadoDesdeFila(row: {
  lugar: string;
  fecha: string | null;
  vendedores: unknown;
  compradores: unknown;
  finca_descripcion: string | null;
  titulo_adquisicion: string | null;
  precio: number | string | null;
  pago_inicial: number | string | null;
  cuota_mensual: number | string | null;
  cuota_desde: string | null;
  cuenta_vendedora: string | null;
  plazo_escritura: string | null;
  plazo_posesion: string | null;
  penalizacion_mensual: number | string | null;
  clausulas_personalizadas?: unknown;
}): ContratoPagoAplazadoDatos {
  const vendedores = parsePersonasArras(row.vendedores);
  const compradores = parsePersonasArras(row.compradores);
  return {
    lugar: row.lugar || EMPRESA_DOCUMENTOS.lugar,
    fecha: row.fecha,
    vendedores: vendedores.length ? vendedores : [personaArrasVacia("Don")],
    compradores: compradores.length ? compradores : [personaArrasVacia("Don")],
    finca_descripcion: row.finca_descripcion ?? "",
    titulo_adquisicion: row.titulo_adquisicion ?? "",
    precio: row.precio == null ? null : Number(row.precio),
    pago_inicial: row.pago_inicial == null ? null : Number(row.pago_inicial),
    cuota_mensual: row.cuota_mensual == null ? null : Number(row.cuota_mensual),
    cuota_desde: row.cuota_desde ?? "",
    cuenta_vendedora: row.cuenta_vendedora ?? "",
    plazo_escritura: row.plazo_escritura ?? "",
    plazo_posesion: row.plazo_posesion ?? "",
    penalizacion_mensual: row.penalizacion_mensual == null ? null : Number(row.penalizacion_mensual),
    clausulas_personalizadas: parseClausulasPagoAplazado(row.clausulas_personalizadas),
  };
}

export type ClausulasPreviewPago = ClausulasPersonalizadasArras;
