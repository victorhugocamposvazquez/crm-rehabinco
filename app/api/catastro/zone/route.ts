import { responderZonaEstado } from "@/lib/catastro/search-zone";
import { explorerStoreDesdeSesion, respuestaRastreoDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { user, role, archive } = await explorerStoreDesdeSesion();
  const bloqueo = respuestaRastreoDesdeSesion(user, role);
  if (bloqueo) return bloqueo;
  return responderZonaEstado(request, user, { archive });
}
