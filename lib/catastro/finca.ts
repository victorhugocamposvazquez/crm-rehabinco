import { getFincaReference, getPropertyReference } from "./references";
import type { EstadoDhFinca } from "./applicability";
import type { UnknownReason } from "./unknown-reason";
import type { InmuebleNormalizado, UnidadConstructiva } from "./types";

export type DireccionFinca = {
  provincia: string | null;
  municipio: string | null;
  sigla: string | null;
  via: string | null;
  /** `pnp` oficial, sin normalizar. Solo si todas las RC coinciden. */
  numero?: string;
  /** `snp` oficial (BIS, A…). Solo si todas las RC coinciden. */
  numero2?: string;
  /** `ldt` oficial si Catastro lo envió y es único. */
  literal?: string;
};

/**
 * Atributos de una RC de 20 caracteres. No se promocionan a la finca.
 */
export type InmuebleDeFinca = {
  reference: string;
  postalCode?: string;
  numero?: string;
  numero2?: string;
  bloque?: string;
  escalera?: string;
  planta?: string;
  puerta?: string;
  literal?: string;
  superficie?: number;
  anio?: number;
  uso?: string;
  unidades: UnidadConstructiva[];
};

/** Entidad canónica de Catastro Explorer (`CatastroFinca`). */
export type FincaDescubierta = {
  /** Derivado: primeros 14 caracteres de la RC. */
  fincaReference: string;
  /** Oficiales: RC de 20 caracteres. */
  propertyReferences: string[];
  properties: InmuebleDeFinca[];
  portals: string[];
  address: DireccionFinca;
  /** Primer CP oficial observado. Compatibilidad; ver `postalCodes`. */
  postalCode?: string;
  /** Todos los CP oficiales vistos en las RC de esta finca. */
  postalCodes: string[];
  ltp?: string;
  /** Oficial `finca.dff.ss` si la consulta de detalle lo trajo. */
  superficieSolar?: number;
  /**
   * YES/NO/UNKNOWN: solo a partir de `finca.ltp`.
   * NOT_APPLICABLE: suelo/no construido oficial; la pregunta de DH no aplica.
   */
  horizontalDivision: {
    status: EstadoDhFinca;
    confidence: number;
    reason: string;
    /** Solo UNKNOWN. No cambia el status ni la candidatura. */
    reasonCode?: UnknownReason;
  };
};

function unicoOUndefined(valores: Array<string | null | undefined>): string | undefined {
  const unicos = [...new Set(valores.filter((item): item is string => Boolean(item)))];
  return unicos.length === 1 ? unicos[0] : undefined;
}

function unicosOrdenados(valores: Array<string | null | undefined>): string[] {
  return [...new Set(valores.filter((item): item is string => Boolean(item)))].sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

export function propiedadDesdeInmueble(inmueble: InmuebleNormalizado): InmuebleDeFinca | null {
  const reference = getPropertyReference(inmueble.referenciaCatastral);
  if (!reference) return null;
  const dir = inmueble.direccion;
  return {
    reference,
    postalCode: dir.codigoPostal ?? undefined,
    numero: dir.numero ?? undefined,
    numero2: dir.numero2 ?? undefined,
    bloque: dir.bloque ?? undefined,
    escalera: dir.escalera ?? undefined,
    planta: dir.planta ?? undefined,
    puerta: dir.puerta ?? undefined,
    literal: dir.literal ?? undefined,
    superficie: inmueble.superficie ?? undefined,
    anio: inmueble.anio ?? undefined,
    uso: inmueble.uso ?? undefined,
    unidades: inmueble.unidades,
  };
}

export function propiedadesDesdeInmuebles(inmuebles: InmuebleNormalizado[]): InmuebleDeFinca[] {
  const porRef = new Map<string, InmuebleDeFinca>();
  for (const inmueble of inmuebles) {
    const propiedad = propiedadDesdeInmueble(inmueble);
    if (!propiedad) continue;
    const previa = porRef.get(propiedad.reference);
    porRef.set(propiedad.reference, previa ? fusionarPropiedad(previa, propiedad) : propiedad);
  }
  return [...porRef.values()].sort((a, b) => a.reference.localeCompare(b.reference));
}

export function fusionarPropiedad(previa: InmuebleDeFinca, actual: InmuebleDeFinca): InmuebleDeFinca {
  return {
    reference: actual.reference,
    postalCode: actual.postalCode ?? previa.postalCode,
    numero: actual.numero ?? previa.numero,
    numero2: actual.numero2 ?? previa.numero2,
    bloque: actual.bloque ?? previa.bloque,
    escalera: actual.escalera ?? previa.escalera,
    planta: actual.planta ?? previa.planta,
    puerta: actual.puerta ?? previa.puerta,
    literal: actual.literal ?? previa.literal,
    superficie: actual.superficie ?? previa.superficie,
    anio: actual.anio ?? previa.anio,
    uso: actual.uso ?? previa.uso,
    unidades: actual.unidades.length > 0 ? actual.unidades : previa.unidades,
  };
}

export function codigosPostalesOficiales(
  inmuebles: InmuebleNormalizado[] | InmuebleDeFinca[]
): string[] {
  return unicosOrdenados(
    inmuebles.map((item) =>
      "direccion" in item ? item.direccion.codigoPostal : item.postalCode
    )
  );
}

export function coincideCodigoPostal(
  postalCodes: string[] | undefined,
  filtro: string | undefined
): boolean {
  if (!filtro) return true;
  const objetivo = filtro.trim();
  if (!objetivo) return true;
  return (postalCodes ?? []).includes(objetivo);
}

/**
 * Estadísticas del prefiltro seguro por CP.
 * Puede haber falsos positivos (procesamos de más); nunca falsos negativos.
 */
export type PrefiltroCodigoPostal = {
  propertiesSeen: number;
  propertiesRejectedByPostalCode: number;
  fincasPotentiallyMatchingPostalCode: number;
  dnprcAvoidedByPostalCode: number;
};

export const PREFILTRO_CODIGO_POSTAL_VACIO: PrefiltroCodigoPostal = {
  propertiesSeen: 0,
  propertiesRejectedByPostalCode: 0,
  fincasPotentiallyMatchingPostalCode: 0,
  dnprcAvoidedByPostalCode: 0,
};

export function sumarPrefiltroCodigoPostal(
  a: PrefiltroCodigoPostal,
  b: PrefiltroCodigoPostal
): PrefiltroCodigoPostal {
  return {
    propertiesSeen: a.propertiesSeen + b.propertiesSeen,
    propertiesRejectedByPostalCode:
      a.propertiesRejectedByPostalCode + b.propertiesRejectedByPostalCode,
    fincasPotentiallyMatchingPostalCode:
      a.fincasPotentiallyMatchingPostalCode + b.fincasPotentiallyMatchingPostalCode,
    dnprcAvoidedByPostalCode: a.dnprcAvoidedByPostalCode + b.dnprcAvoidedByPostalCode,
  };
}

/** CP oficial de una RC. Vacío o ausente → `undefined` (no se inventa). */
export function codigoPostalDePropiedad(
  item: InmuebleNormalizado | InmuebleDeFinca
): string | undefined {
  const crudo = "direccion" in item ? item.direccion.codigoPostal : item.postalCode;
  const texto = crudo?.trim();
  return texto || undefined;
}

/**
 * Prefiltro seguro por propiedad/RC.
 * CP distinto → se descarta. CP coincidente o ausente → se conserva.
 * Sin filtro (búsqueda sin CP) → no se toca nada.
 */
export function filtrarPropiedadesPorCodigoPostal<T extends InmuebleNormalizado | InmuebleDeFinca>(
  propiedades: T[],
  filtro: string | undefined
): T[] {
  const objetivo = filtro?.trim();
  if (!objetivo) return propiedades;
  return propiedades.filter((item) => {
    const cp = codigoPostalDePropiedad(item);
    return cp == null || cp === objetivo;
  });
}

/** True si alguna RC coincide o no tiene CP. Nunca descarta por ausencia. */
export function fincaPuedePertenecerAlCodigoPostal(
  inmuebles: ReadonlyArray<InmuebleNormalizado | InmuebleDeFinca>,
  filtro: string | undefined
): boolean {
  const objetivo = filtro?.trim();
  if (!objetivo) return true;
  return inmuebles.some((item) => {
    const cp = codigoPostalDePropiedad(item);
    return cp == null || cp === objetivo;
  });
}

function grupoNecesitaConsultaDetalle(inmuebles: InmuebleNormalizado[]): boolean {
  return !inmuebles.some((item) => item.finca?.tipoLiteral?.trim());
}

/**
 * Decide qué fincas merecen resolver `ltp`.
 * La identidad y el grupo completo (todas las RC) se conservan.
 * Sin CP → identidad (no se aplica el prefiltro).
 */
export function seleccionarFincasParaResolverLtp(
  grupos: Map<string, InmuebleNormalizado[]>,
  postalCode?: string
): { grupos: Map<string, InmuebleNormalizado[]>; stats: PrefiltroCodigoPostal } {
  const filtro = postalCode?.trim();
  if (!filtro) {
    return { grupos, stats: { ...PREFILTRO_CODIGO_POSTAL_VACIO } };
  }

  const seleccion = new Map<string, InmuebleNormalizado[]>();
  const stats: PrefiltroCodigoPostal = { ...PREFILTRO_CODIGO_POSTAL_VACIO };

  for (const [parcela, grupo] of grupos) {
    stats.propertiesSeen += grupo.length;
    const conservadas = filtrarPropiedadesPorCodigoPostal(grupo, filtro);
    stats.propertiesRejectedByPostalCode += grupo.length - conservadas.length;
    if (conservadas.length === 0) {
      if (grupoNecesitaConsultaDetalle(grupo)) {
        stats.dnprcAvoidedByPostalCode += 1;
      }
      continue;
    }
    stats.fincasPotentiallyMatchingPostalCode += 1;
    seleccion.set(parcela, grupo);
  }

  return { grupos: seleccion, stats };
}

export function direccionOficialDeFinca(
  inmuebles: InmuebleNormalizado[],
  query: { provincia: string; municipio: string; sigla: string; via: string }
): DireccionFinca {
  const dir = inmuebles.find((item) => item.direccion.via || item.direccion.provincia)?.direccion;
  return {
    provincia: dir?.provincia ?? query.provincia,
    municipio: dir?.municipio ?? query.municipio,
    sigla: dir?.tipoVia ?? query.sigla,
    via: dir?.via ?? query.via,
    numero: unicoOUndefined(inmuebles.map((item) => item.direccion.numero)),
    numero2: unicoOUndefined(inmuebles.map((item) => item.direccion.numero2)),
    literal: unicoOUndefined(inmuebles.map((item) => item.direccion.literal)),
  };
}

export function superficieSolarOficial(inmuebles: InmuebleNormalizado[]): number | undefined {
  for (const inmueble of inmuebles) {
    if (inmueble.finca?.superficieSolar != null) return inmueble.finca.superficieSolar;
  }
  return undefined;
}

export function fusionarDireccionFinca(
  previa: DireccionFinca,
  actual: DireccionFinca
): DireccionFinca {
  const numero =
    previa.numero && actual.numero && previa.numero !== actual.numero
      ? undefined
      : actual.numero ?? previa.numero;
  const numero2 =
    previa.numero2 && actual.numero2 && previa.numero2 !== actual.numero2
      ? undefined
      : actual.numero2 ?? previa.numero2;
  const literal =
    previa.literal && actual.literal && previa.literal !== actual.literal
      ? undefined
      : actual.literal ?? previa.literal;
  return {
    provincia: actual.provincia ?? previa.provincia,
    municipio: actual.municipio ?? previa.municipio,
    sigla: actual.sigla ?? previa.sigla,
    via: actual.via ?? previa.via,
    numero,
    numero2,
    literal,
  };
}

export function referenciasInmuebleValidas(referencias: string[]): string[] {
  return [...new Set(referencias.map(getPropertyReference).filter((ref): ref is string => Boolean(ref)))].sort();
}

export function identidadFincaDeReferencias(referencias: string[]): string | null {
  const identidades = [
    ...new Set(referencias.map(getFincaReference).filter((ref): ref is string => Boolean(ref))),
  ];
  return identidades.length === 1 ? identidades[0] : null;
}
