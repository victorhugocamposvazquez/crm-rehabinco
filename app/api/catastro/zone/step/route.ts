import { responderZonaPaso } from "@/lib/catastro/search-zone";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Cada paso trabaja ≤ 25 s (ZONE_STEP_MAX_BUDGET_MS) más el margen de las peticiones en vuelo. */
export const maxDuration = 120;

export async function POST(request: Request) {
  const { user, store, archive } = await explorerStoreDesdeSesion();
  return responderZonaPaso(request, user, { explorerStore: store, archive });
}
