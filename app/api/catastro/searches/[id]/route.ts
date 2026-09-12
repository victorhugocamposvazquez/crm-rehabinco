import {
  acotarPaginaResultados,
  eliminarBusqueda,
  resumenBusquedaReciente,
} from "@/lib/catastro/explorer";
import { fincaUiDesdeRecord } from "@/lib/catastro/explorer/history-ui";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, store, properties } = await explorerStoreDesdeSesion();
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }

  const { id } = await context.params;
  const search = await store.getSearch(id, user.id);
  if (!search) {
    return Response.json({ ok: false, error: "Búsqueda no encontrada." }, { status: 404 });
  }

  const params = new URL(request.url).searchParams;
  const pagina = acotarPaginaResultados(
    params.get("limit") ? Number(params.get("limit")) : undefined,
    params.get("offset") ? Number(params.get("offset")) : undefined
  );
  const results = await store.listResultsPage(id, pagina);
  const fincas = await store.getFincas(results.items.map((item) => item.fincaReference));
  const porRef = new Map(fincas.map((finca) => [finca.fincaReference, finca]));
  const reviews = await store.listReviews(
    user.id,
    results.items.map((item) => item.fincaReference)
  );
  const links = await properties.findLinksByFincaReferences(
    results.items.map((item) => item.fincaReference)
  );

  return Response.json({
    ok: true,
    search,
    summary: {
      id: search.id,
      mode: search.criteria.mode,
      ...resumenBusquedaReciente(search),
      coverage: {
        complete: search.coverage.complete,
        possibleCut: search.coverage.possibleCut,
      },
    },
    results: {
      items: results.items,
      fincas: results.items
        .map((item) => porRef.get(item.fincaReference))
        .filter((finca): finca is NonNullable<typeof finca> => finca != null)
        .map(fincaUiDesdeRecord),
      total: results.total,
      limit: results.limit,
      offset: results.offset,
    },
    reviews,
    links,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user, store } = await explorerStoreDesdeSesion();
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }

  const { id } = await context.params;
  const resultado = await eliminarBusqueda(store, id, user.id);
  if (resultado === "not_found") {
    return Response.json({ ok: false, error: "Búsqueda no encontrada." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
