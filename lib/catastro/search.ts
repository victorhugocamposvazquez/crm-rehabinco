import { getCatastroClient, type CatastroClient } from "./client";
import { CatastroHttpError } from "./http";
import { separarTipoVia } from "./parse";
import type { ConsultaDireccion, ResultadoConsultaCatastro } from "./types";

export type QueryBusqueda = {
  provincia: string;
  municipio: string;
  calle: string;
  numero: string;
  sigla: string | null;
  bloque: string | null;
  escalera: string | null;
  planta: string | null;
  puerta: string | null;
};

export type RespuestaBusquedaCatastro = Omit<ResultadoConsultaCatastro, "query"> & {
  query: QueryBusqueda;
  queryCatastro: ResultadoConsultaCatastro["query"];
};

const CAMPOS_OBLIGATORIOS = ["provincia", "municipio", "calle", "numero"] as const;

function leerParametro(params: URLSearchParams, nombre: string): string {
  return params.get(nombre)?.trim() ?? "";
}

export function parsearBusqueda(
  params: URLSearchParams
):
  | { ok: true; consulta: ConsultaDireccion; query: QueryBusqueda }
  | { ok: false; error: string } {
  const faltan = CAMPOS_OBLIGATORIOS.filter((campo) => !leerParametro(params, campo));
  if (faltan.length > 0) {
    return {
      ok: false,
      error: `Faltan parámetros obligatorios: ${faltan.join(", ")}.`,
    };
  }

  const provincia = leerParametro(params, "provincia");
  const municipio = leerParametro(params, "municipio");
  const calle = leerParametro(params, "calle");
  const numero = leerParametro(params, "numero");
  const siglaParam = leerParametro(params, "sigla");
  const via = separarTipoVia(calle, siglaParam || undefined);

  if (!via.sigla) {
    return {
      ok: false,
      error:
        "Falta la sigla de tipo de vía (parámetro oficial Sigla de Consulta_DNPLOC). Indica sigla=CL o antepón un tipo del Anexo II, por ejemplo Calle Fuencarral. No se asume CL.",
    };
  }

  const query: QueryBusqueda = {
    provincia,
    municipio,
    calle,
    numero,
    sigla: via.sigla,
    bloque: leerParametro(params, "bloque") || null,
    escalera: leerParametro(params, "escalera") || null,
    planta: leerParametro(params, "planta") || null,
    puerta: leerParametro(params, "puerta") || null,
  };

  return {
    ok: true,
    query,
    consulta: {
      provincia,
      municipio,
      calle: via.calle,
      numero,
      sigla: via.sigla,
      bloque: query.bloque ?? undefined,
      escalera: query.escalera ?? undefined,
      planta: query.planta ?? undefined,
      puerta: query.puerta ?? undefined,
    },
  };
}

export async function responderBusquedaCatastro(
  request: Request,
  user: { id: string } | null,
  client: CatastroClient = getCatastroClient()
): Promise<Response> {
  if (!user) {
    return Response.json({ error: "Sesión expirada" }, { status: 401 });
  }

  const parsed = parsearBusqueda(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const resultado = await client.consultarDireccion(parsed.consulta);
    const { query: queryCatastro, ...resto } = resultado;
    const body: RespuestaBusquedaCatastro = {
      ...resto,
      query: parsed.query,
      queryCatastro,
    };
    return Response.json(body);
  } catch (error) {
    const message =
      error instanceof CatastroHttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Error al consultar Catastro";
    console.error("[catastro:search]", message);
    return Response.json({ error: message }, { status: 502 });
  }
}
