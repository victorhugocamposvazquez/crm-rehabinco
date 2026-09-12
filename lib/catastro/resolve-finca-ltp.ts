import { evaluarAplicabilidadDh } from "./applicability";
import type { EstadoDhFinca } from "./applicability";
import type { CatastroClient } from "./client";
import { superficieSolarOficial } from "./finca";
import {
  detectHorizontalDivision,
  type ResultadoDivisionHorizontal,
} from "./horizontal-division";
import {
  esReferenciaInmueble,
  getFincaReference,
  normalizarReferencia,
  referenciaParcelaDe,
} from "./references";
import type { InmuebleNormalizado, ResultadoConsultaCatastro } from "./types";

export type ClasificacionFinca = Omit<ResultadoDivisionHorizontal, "status" | "classification"> & {
  status: EstadoDhFinca;
  classification: EstadoDhFinca;
  referenciaParcela: string | null;
  referenciaConsultada: string | null;
  consultasDetalle: number;
  superficieSolar?: number;
};

function clasificacionNoAplicable(
  reason: string,
  parcela: string | null,
  extras: {
    referenciaConsultada: string | null;
    consultasDetalle: number;
    superficieSolar?: number;
  }
): ClasificacionFinca {
  return {
    status: "NOT_APPLICABLE",
    classification: "NOT_APPLICABLE",
    confidence: 1,
    rawLtp: null,
    evidence: null,
    reason,
    evidenceItems: [],
    referenciaParcela: parcela,
    ...extras,
  };
}

export { getFincaReference, referenciaParcelaDe, esReferenciaInmueble };

const ltpCachePorCliente = new WeakMap<object, Map<string, Promise<ClasificacionFinca>>>();

function cacheLtpDe(client: object): Map<string, Promise<ClasificacionFinca>> {
  let cache = ltpCachePorCliente.get(client);
  if (!cache) {
    cache = new Map();
    ltpCachePorCliente.set(client, cache);
  }
  return cache;
}

export function agruparPorFinca(
  inmuebles: InmuebleNormalizado[]
): Map<string, InmuebleNormalizado[]> {
  const grupos = new Map<string, InmuebleNormalizado[]>();
  for (const inmueble of inmuebles) {
    const clave =
      getFincaReference(inmueble.referenciaParcela) ??
      getFincaReference(inmueble.referenciaCatastral);
    if (!clave) continue;
    const grupo = grupos.get(clave) ?? [];
    grupo.push(inmueble);
    grupos.set(clave, grupo);
  }
  return grupos;
}

/** Una sola RC de 20 caracteres por finca. No se usa la de 14: devuelve lista sin `finca`. */
export function seleccionarReferenciaDetalle(
  inmuebles: InmuebleNormalizado[]
): string | null {
  const refs = inmuebles
    .map((item) => item.referenciaCatastral)
    .filter(esReferenciaInmueble)
    .map((ref) => normalizarReferencia(ref))
    .sort();
  return refs[0] ?? null;
}

function ltpYaPresente(inmuebles: InmuebleNormalizado[]): string | null {
  for (const inmueble of inmuebles) {
    const ltp = inmueble.finca?.tipoLiteral?.trim();
    if (ltp) return ltp;
  }
  return null;
}

export async function clasificarFincaPorLtp(
  inmuebles: InmuebleNormalizado[],
  client: Pick<CatastroClient, "consultarReferencia">,
  referenciaParcela: string | null = null
): Promise<ClasificacionFinca> {
  const parcela =
    getFincaReference(referenciaParcela) ??
    getFincaReference(inmuebles[0]?.referenciaParcela) ??
    getFincaReference(inmuebles[0]?.referenciaCatastral);

  const cache = cacheLtpDe(client);
  if (parcela) {
    const previa = cache.get(parcela);
    if (previa) return previa;
  }

  const trabajo = resolverLtp(inmuebles, client, parcela);
  if (parcela) cache.set(parcela, trabajo);
  return trabajo;
}

async function resolverLtp(
  inmuebles: InmuebleNormalizado[],
  client: Pick<CatastroClient, "consultarReferencia">,
  parcela: string | null
): Promise<ClasificacionFinca> {
  const aplicabilidadLocal = evaluarAplicabilidadDh(inmuebles);
  if (!aplicabilidadLocal.aplicable) {
    return clasificacionNoAplicable(aplicabilidadLocal.reason, parcela, {
      referenciaConsultada: null,
      consultasDetalle: 0,
      superficieSolar: superficieSolarOficial(inmuebles),
    });
  }

  const ltpLocal = ltpYaPresente(inmuebles);
  if (ltpLocal) {
    return {
      ...detectHorizontalDivision({ rawLtp: ltpLocal }),
      referenciaParcela: parcela,
      referenciaConsultada: null,
      consultasDetalle: 0,
      superficieSolar: superficieSolarOficial(inmuebles),
    };
  }

  const referenciaConsultada = seleccionarReferenciaDetalle(inmuebles);
  if (!referenciaConsultada) {
    return {
      ...detectHorizontalDivision({ rawLtp: null }),
      referenciaParcela: parcela,
      referenciaConsultada: null,
      consultasDetalle: 0,
      superficieSolar: superficieSolarOficial(inmuebles),
    };
  }

  try {
    const detalle = await client.consultarReferencia({ refCat: referenciaConsultada });
    if (detalle.error) {
      return {
        ...detectHorizontalDivision({ error: detalle.error }),
        referenciaParcela: parcela,
        referenciaConsultada,
        consultasDetalle: 1,
        superficieSolar: superficieSolarOficial(inmuebles),
      };
    }
    const aplicabilidadDetalle = evaluarAplicabilidadDh(detalle.results);
    if (!aplicabilidadDetalle.aplicable) {
      return clasificacionNoAplicable(aplicabilidadDetalle.reason, parcela, {
        referenciaConsultada,
        consultasDetalle: 1,
        superficieSolar: superficieSolarOficial(detalle.results) ?? superficieSolarOficial(inmuebles),
      });
    }
    return {
      ...detectHorizontalDivision(detalle),
      referenciaParcela: parcela,
      referenciaConsultada,
      consultasDetalle: 1,
      superficieSolar: superficieSolarOficial(detalle.results) ?? superficieSolarOficial(inmuebles),
    };
  } catch {
    return {
      ...detectHorizontalDivision({
        error: { codigo: "http", descripcion: "Error al consultar el detalle de la finca" },
      }),
      referenciaParcela: parcela,
      referenciaConsultada,
      consultasDetalle: 1,
      superficieSolar: superficieSolarOficial(inmuebles),
    };
  }
}

export async function resolverDivisionHorizontal(
  consulta: ResultadoConsultaCatastro,
  client: Pick<CatastroClient, "consultarReferencia">
): Promise<ClasificacionFinca[]> {
  if (consulta.error) {
    return [
      {
        ...detectHorizontalDivision(consulta),
        referenciaParcela: null,
        referenciaConsultada: null,
        consultasDetalle: 0,
      },
    ];
  }

  const grupos = agruparPorFinca(consulta.results);
  if (grupos.size === 0) {
    return [
      {
        ...detectHorizontalDivision(consulta),
        referenciaParcela: null,
        referenciaConsultada: null,
        consultasDetalle: 0,
      },
    ];
  }

  const clasificaciones: ClasificacionFinca[] = [];
  for (const [parcela, inmuebles] of grupos) {
    clasificaciones.push(await clasificarFincaPorLtp(inmuebles, client, parcela));
  }
  return clasificaciones;
}
