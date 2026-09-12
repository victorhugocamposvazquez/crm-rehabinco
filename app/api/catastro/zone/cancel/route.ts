import { responderZonaCancelar } from "@/lib/catastro/search-zone";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user, store, archive } = await explorerStoreDesdeSesion();
  return responderZonaCancelar(request, user, { explorerStore: store, archive });
}
