import { getCatastroClient, type CatastroClient } from "./client";
import {
  buscarFincasComerciales,
  type CriteriosBusquedaComercial,
  type EjecucionBusquedaComercial,
  type ErrorBusquedaComercial,
  type ResultadoBusquedaComercial,
} from "./commercial-search";
import { getDiscoveryStore, type DiscoverySessionStore } from "./discovery-session";
import {
  clockSistema,
  persistirBusqueda,
  propuestaBusqueda,
  type ExplorerClock,
  type ExplorerStore,
} from "./explorer";

function leer(params: URLSearchParams, nombre: string): string {
  return params.get(nombre)?.trim() ?? "";
}

export function parsearCriteriosComerciales(
  params: URLSearchParams
): CriteriosBusquedaComercial {
  const pageSizeRaw = leer(params, "pageSize") || leer(params, "maxPortals");
  const pageSize = pageSizeRaw && /^\d+$/.test(pageSizeRaw) ? Number(pageSizeRaw) : undefined;
  return {
    provincia: leer(params, "provincia") || undefined,
    municipio: leer(params, "municipio") || undefined,
    sigla: leer(params, "sigla") || undefined,
    via: leer(params, "via") || leer(params, "calle") || undefined,
    numero: leer(params, "numero") || undefined,
    postalCode: leer(params, "postalCode") || leer(params, "codigoPostal") || undefined,
    horizontalDivision: leer(params, "horizontalDivision") || undefined,
    pageSize,
    cursor: leer(params, "cursor") || undefined,
  };
}

function statusDe(error: ErrorBusquedaComercial): number {
  if (error.code === "invalid") return 400;
  if (error.code === "not_found") return 404;
  if (error.code === "expired") return 410;
  return 502;
}

export type ComercialHttpDeps = {
  explorerStore?: ExplorerStore;
  clock?: ExplorerClock;
};

async function persistirCalle(
  userId: string,
  ejecucion: EjecucionBusquedaComercial,
  deps: ComercialHttpDeps
): Promise<void> {
  if (!deps.explorerStore) return;
  const now = (deps.clock ?? clockSistema).nowIso();
  const searchId = ejecucion.discovery.discovery.discoveryId ?? crypto.randomUUID();
  const search = ejecucion.resultado.search;
  const coverage = ejecucion.resultado.coverage;
  try {
    await persistirBusqueda(
      deps.explorerStore,
      propuestaBusqueda({
        id: searchId,
        ownerId: userId,
        criteria: {
          mode: "STREET",
          provincia: search.provincia,
          municipio: search.municipio,
          sigla: search.sigla,
          via: search.via,
          ...(search.numero ? { numero: search.numero } : {}),
          ...(search.postalCode ? { postalCode: search.postalCode } : {}),
          horizontalDivision: search.horizontalDivision,
        },
        status: ejecucion.resultado.pagination.hasNextPage ? "RUNNING" : "COMPLETED",
        coverage: {
          complete: coverage.complete,
          completeCandidates: coverage.completeCandidates,
          possibleCut: coverage.possibleCut,
          portalsFound: coverage.portalsFound,
          portalsProcessed: coverage.portalsProcessed,
        },
        fincas: ejecucion.candidatos.all,
        now,
      }),
      ejecucion.candidatos.all,
      now
    );
  } catch (error) {
    console.error(
      "[catastro:explorer-store]",
      error instanceof Error ? error.message : error
    );
  }
}

export async function responderBusquedaComercial(
  request: Request,
  user: { id: string } | null,
  client: CatastroClient = getCatastroClient(),
  store: DiscoverySessionStore = getDiscoveryStore(),
  deps: ComercialHttpDeps = {}
): Promise<Response> {
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }

  const criterios = parsearCriteriosComerciales(new URL(request.url).searchParams);
  const pageSizeRaw =
    new URL(request.url).searchParams.get("pageSize") ??
    new URL(request.url).searchParams.get("maxPortals");
  if (pageSizeRaw && !/^\d+$/.test(pageSizeRaw.trim())) {
    return Response.json(
      { ok: false, error: "El parámetro pageSize debe ser un entero no negativo." },
      { status: 400 }
    );
  }

  const ejecucion = await buscarFincasComerciales(criterios, { client, store });
  if (!ejecucion.ok) {
    return Response.json(
      { ok: false, error: ejecucion.error, search: ejecucion.search },
      { status: statusDe(ejecucion) }
    );
  }

  const cuerpo: ResultadoBusquedaComercial = ejecucion.resultado;
  await persistirCalle(user.id, ejecucion, deps);
  return Response.json(cuerpo);
}
