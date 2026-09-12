import {
  consultaHistoricoBusquedas,
  resumenBusquedaReciente,
} from "@/lib/catastro/explorer";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { user, store } = await explorerStoreDesdeSesion();
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const query = consultaHistoricoBusquedas({
    limit: params.get("limit") ? Number(params.get("limit")) : undefined,
    offset: params.get("offset") ? Number(params.get("offset")) : undefined,
    mode: params.get("mode"),
    status: params.get("status"),
  });
  const pagina = await store.listSearches(user.id, query);

  return Response.json({
    ok: true,
    searches: pagina.items.map((search) => ({
      id: search.id,
      mode: search.criteria.mode,
      ...resumenBusquedaReciente(search),
      coverage: {
        complete: search.coverage.complete,
        possibleCut: search.coverage.possibleCut,
      },
    })),
    total: pagina.total,
    limit: pagina.limit,
    offset: pagina.offset,
  });
}
