export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ConsultaDireccion = {
  provincia: string;
  municipio: string;
  /** Sigla oficial de tipo de vía (Anexo II), p. ej. CL, AV. */
  sigla?: string;
  calle: string;
  numero: string;
  bloque?: string;
  escalera?: string;
  planta?: string;
  puerta?: string;
};

export type ConsultaReferencia = {
  refCat: string;
  provincia?: string;
  municipio?: string;
};

export type ConsultaPoligonoParcela = {
  provincia: string;
  municipio: string;
  poligono: string;
  parcela: string;
};

export type ErrorCatastro = {
  codigo: string;
  descripcion: string;
};

export type DireccionNormalizada = {
  tipoVia: string | null;
  via: string | null;
  numero: string | null;
  numero2: string | null;
  bloque: string | null;
  escalera: string | null;
  planta: string | null;
  puerta: string | null;
  codigoPostal: string | null;
  provincia: string | null;
  municipio: string | null;
  literal: string | null;
};

export type UnidadConstructiva = {
  uso: string | null;
  tipologia: string | null;
  superficie: number | null;
  escalera: string | null;
  planta: string | null;
  puerta: string | null;
};

/**
 * Datos de finca que Catastro incluye en el detalle (`bico.finca`)
 * desde oct-2025. `tipoLiteral` es el campo oficial `ltp`, no una
 * clasificación nuestra de división horizontal.
 */
export type FincaCatastro = {
  literal: string | null;
  tipoLiteral: string | null;
  superficieSolar: number | null;
  urlGrafico: string | null;
};

export type InmuebleNormalizado = {
  referenciaCatastral: string | null;
  referenciaParcela: string | null;
  cargo: string | null;
  tipoBien: string | null;
  direccion: DireccionNormalizada;
  superficie: number | null;
  anio: number | null;
  uso: string | null;
  coeficienteParticipacion: number | null;
  finca: FincaCatastro | null;
  unidades: UnidadConstructiva[];
  raw: JsonValue;
};

export type TipoRespuestaCatastro = "detalle" | "lista" | "error" | "vacio";

export type ResultadoConsultaCatastro = {
  query: Record<string, string>;
  operacion: string;
  tipo: TipoRespuestaCatastro;
  control: {
    inmuebles: number | null;
    construcciones: number | null;
    errores: number | null;
  };
  error: ErrorCatastro | null;
  results: InmuebleNormalizado[];
  raw: JsonValue;
};

export type CatastroClientOptions = {
  minIntervalMs?: number;
  cacheTtlMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};
