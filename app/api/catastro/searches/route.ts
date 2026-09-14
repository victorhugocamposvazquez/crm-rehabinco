import { consultaHistoricoBusquedas } from "@/lib/catastro/explorer";
import { resumenDesdeBusqueda } from "@/lib/catastro/explorer/history-ui";
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
    searches: pagina.items.map(resumenDesdeBusqueda),
    total: pagina.total,
    limit: pagina.limit,
    offset: pagina.offset,
  });
}
