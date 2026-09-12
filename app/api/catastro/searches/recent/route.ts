import {
  EXPLORER_RECENT_LIMIT,
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

  const bruto = Number(new URL(request.url).searchParams.get("limit") ?? EXPLORER_RECENT_LIMIT);
  const limit = Number.isFinite(bruto)
    ? Math.min(EXPLORER_RECENT_LIMIT, Math.max(1, Math.floor(bruto)))
    : EXPLORER_RECENT_LIMIT;
  const searches = await store.listRecentSearches(user.id, limit);

  return Response.json({
    ok: true,
    searches: searches.map((search) => ({
      id: search.id,
      mode: search.criteria.mode,
      ...resumenBusquedaReciente(search),
      coverage: {
        complete: search.coverage.complete,
        possibleCut: search.coverage.possibleCut,
      },
    })),
  });
}
