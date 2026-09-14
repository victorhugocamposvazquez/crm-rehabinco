import { responderZonaCancelar } from "@/lib/catastro/search-zone";
import { explorerStoreDesdeSesion, respuestaRastreoDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user, role, store, archive } = await explorerStoreDesdeSesion();
  const bloqueo = respuestaRastreoDesdeSesion(user, role);
  if (bloqueo) return bloqueo;
  return responderZonaCancelar(request, user, { explorerStore: store, archive });
}
