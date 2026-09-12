import { TIPOS_VIA_OFICIALES } from "./constants";
import type {
  DireccionNormalizada,
  ErrorCatastro,
  FincaCatastro,
  InmuebleNormalizado,
  JsonValue,
  ResultadoConsultaCatastro,
  TipoRespuestaCatastro,
  UnidadConstructiva,
} from "./types";

export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

/** Catastro usa coma decimal en campos como cpt: "100,000000". */
export function parseNumeroCatastral(value: unknown): number | null {
  const text = asString(value);
  if (!text) return null;
  const normalized = text.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseEnteroCatastral(value: unknown): number | null {
  const parsed = parseNumeroCatastral(value);
  if (parsed == null) return null;
  return Number.isInteger(parsed) ? parsed : Math.trunc(parsed);
}

function quitarAcentos(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

export function componerReferencia(rc: Record<string, unknown> | null): {
  referenciaCatastral: string | null;
  referenciaParcela: string | null;
  cargo: string | null;
} {
  if (!rc) {
    return { referenciaCatastral: null, referenciaParcela: null, cargo: null };
  }
  const pc1 = asString(rc.pc1);
  const pc2 = asString(rc.pc2);
  const car = asString(rc.car);
  const cc1 = asString(rc.cc1);
  const cc2 = asString(rc.cc2);
  const referenciaParcela = pc1 && pc2 ? `${pc1}${pc2}` : null;
  const referenciaCatastral =
    referenciaParcela && car && cc1 && cc2
      ? `${referenciaParcela}${car}${cc1}${cc2}`
      : referenciaParcela;
  return { referenciaCatastral, referenciaParcela, cargo: car };
}

/**
 * Separa sigla oficial y nombre de vía si el usuario escribe "Calle Real"
 * o "CL REAL". No inventa tipo: si no encaja con el Anexo II, deja sigla vacía.
 */
export function separarTipoVia(calle: string, sigla?: string): {
  sigla: string;
  calle: string;
} {
  const calleLimpia = calle.trim();
  if (sigla?.trim()) {
    return { sigla: sigla.trim().toUpperCase(), calle: calleLimpia };
  }
  if (!calleLimpia) return { sigla: "", calle: "" };

  const tokens = calleLimpia.split(/\s+/);
  const primero = quitarAcentos(tokens[0] ?? "").toUpperCase();

  const porCodigo = TIPOS_VIA_OFICIALES.find((item) => item.codigo === primero);
  if (porCodigo && tokens.length > 1) {
    return { sigla: porCodigo.codigo, calle: tokens.slice(1).join(" ") };
  }

  const porNombre = TIPOS_VIA_OFICIALES.find((item) =>
    item.nombres.some((nombre) => quitarAcentos(nombre).toUpperCase() === primero)
  );
  if (porNombre && tokens.length > 1) {
    return { sigla: porNombre.codigo, calle: tokens.slice(1).join(" ") };
  }

  return { sigla: "", calle: calleLimpia };
}

function leerDir(dt: Record<string, unknown> | null): {
  dir: Record<string, unknown> | null;
  loint: Record<string, unknown> | null;
  codigoPostal: string | null;
} {
  const locs = asRecord(dt?.locs);
  const lous = asRecord(locs?.lous);
  const lourb = asRecord(lous?.lourb);
  return {
    dir: asRecord(lourb?.dir),
    loint: asRecord(lourb?.loint),
    codigoPostal: asString(lourb?.dp),
  };
}

export function extraerDireccion(
  dt: Record<string, unknown> | null,
  literal: string | null
): DireccionNormalizada {
  const { dir, loint, codigoPostal } = leerDir(dt);
  return {
    tipoVia: asString(dir?.tv),
    via: asString(dir?.nv),
    numero: asString(dir?.pnp),
    numero2: asString(dir?.snp),
    bloque: asString(loint?.bl),
    escalera: asString(loint?.es),
    planta: asString(loint?.pt),
    puerta: asString(loint?.pu),
    codigoPostal,
    provincia: asString(dt?.np),
    municipio: asString(dt?.nm),
    literal,
  };
}

function extraerFinca(finca: unknown): FincaCatastro | null {
  const record = asRecord(finca);
  if (!record) return null;
  const infgraf = asRecord(record.infgraf);
  const dff = asRecord(record.dff);
  return {
    literal: asString(record.ldt),
    tipoLiteral: asString(record.ltp),
    superficieSolar: parseNumeroCatastral(dff?.ss),
    urlGrafico: asString(infgraf?.igraf),
  };
}

function extraerUnidades(lcons: unknown): UnidadConstructiva[] {
  return asArray(lcons).map((item) => {
    const unidad = asRecord(item) ?? {};
    const dt = asRecord(unidad.dt);
    const lourb = asRecord(dt?.lourb);
    const loint = asRecord(lourb?.loint);
    const dfcons = asRecord(unidad.dfcons);
    const dvcons = asRecord(unidad.dvcons);
    return {
      uso: asString(unidad.lcd),
      tipologia: asString(dvcons?.dtip),
      superficie: parseNumeroCatastral(dfcons?.stl),
      escalera: asString(loint?.es),
      planta: asString(loint?.pt),
      puerta: asString(loint?.pu),
    };
  });
}

function extraerInmueble(
  item: unknown,
  finca: FincaCatastro | null,
  unidades: UnidadConstructiva[]
): InmuebleNormalizado {
  const record = asRecord(item) ?? {};
  const idbi = asRecord(record.idbi);
  const rc = asRecord(record.rc) ?? asRecord(idbi?.rc);
  const dt = asRecord(record.dt);
  const debi = asRecord(record.debi);
  const refs = componerReferencia(rc);

  return {
    ...refs,
    tipoBien: asString(idbi?.cn),
    direccion: extraerDireccion(dt, asString(record.ldt)),
    superficie: parseNumeroCatastral(debi?.sfc),
    anio: parseEnteroCatastral(debi?.ant),
    uso: asString(debi?.luso),
    coeficienteParticipacion: parseNumeroCatastral(debi?.cpt),
    finca,
    unidades,
    raw: (item ?? null) as JsonValue,
  };
}

function extraerError(payload: Record<string, unknown>): ErrorCatastro | null {
  const primero = asArray(payload.lerr)[0];
  const record = asRecord(primero);
  if (!record) return null;
  const codigo = asString(record.cod);
  const descripcion = asString(record.des);
  if (!codigo && !descripcion) return null;
  return { codigo: codigo ?? "", descripcion: descripcion ?? "" };
}

function unwrapConsulta(raw: unknown): {
  operacion: string;
  payload: Record<string, unknown>;
} {
  const root = asRecord(raw);
  if (!root) return { operacion: "desconocida", payload: {} };

  const wrappers: Array<[string, string]> = [
    ["consulta_dnplocResult", "Consulta_DNPLOC"],
    ["consulta_dnprcResult", "Consulta_DNPRC"],
    ["consulta_dnpppResult", "Consulta_DNPPP"],
  ];

  for (const [key, operacion] of wrappers) {
    const inner = asRecord(root[key]);
    if (inner) return { operacion, payload: inner };
  }

  if (root.control || root.bico || root.lrcdnp || root.lerr) {
    return { operacion: "consulta_dnp", payload: root };
  }

  return { operacion: "desconocida", payload: root };
}

export function parseConsultaDnp(
  raw: unknown,
  query: Record<string, string> = {}
): ResultadoConsultaCatastro {
  const { operacion, payload } = unwrapConsulta(raw);
  const control = asRecord(payload.control) ?? {};
  const error = extraerError(payload);
  const bico = asRecord(payload.bico);
  const lrcdnp = asRecord(payload.lrcdnp);
  const lista = asArray(lrcdnp?.rcdnp);

  let tipo: TipoRespuestaCatastro = "vacio";
  let results: InmuebleNormalizado[] = [];

  if (error) {
    tipo = "error";
  } else if (bico) {
    tipo = "detalle";
    results = [
      extraerInmueble(bico.bi, extraerFinca(bico.finca), extraerUnidades(bico.lcons)),
    ];
  } else if (lista.length > 0) {
    tipo = "lista";
    results = lista.map((item) => extraerInmueble(item, null, []));
  }

  return {
    query,
    operacion,
    tipo,
    control: {
      inmuebles: parseEnteroCatastral(control.cudnp),
      construcciones: parseEnteroCatastral(control.cucons),
      errores: parseEnteroCatastral(control.cuerr),
    },
    error,
    results,
    raw: (raw ?? null) as JsonValue,
  };
}
