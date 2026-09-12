import { responderZonaEstado } from "@/lib/catastro/search-zone";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { user, archive } = await explorerStoreDesdeSesion();
  return responderZonaEstado(request, user, { archive });
}
