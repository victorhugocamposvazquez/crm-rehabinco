import { responderZonaReanudar } from "@/lib/catastro/search-zone";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user, store, archive } = await explorerStoreDesdeSesion();
  return responderZonaReanudar(request, user, { explorerStore: store, archive });
}
