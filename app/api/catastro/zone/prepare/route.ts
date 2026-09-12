import { responderZonaPreparar } from "@/lib/catastro/search-zone";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const { user, store } = await explorerStoreDesdeSesion();
  return responderZonaPreparar(request, user, { explorerStore: store });
}
