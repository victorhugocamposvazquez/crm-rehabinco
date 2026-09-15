/** Adaptador HTTP del host CRM. La sesión es del host; el dominio está en lib/catastro. */
import { responderBusquedaComercial } from "@/lib/catastro/search-commercial";
import { explorerStoreDesdeSesion, respuestaRastreoDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { user, role, store } = await explorerStoreDesdeSesion();
  const bloqueo = respuestaRastreoDesdeSesion(user, role);
  if (bloqueo) return bloqueo;
  return responderBusquedaComercial(request, user, undefined, undefined, {
    explorerStore: store,
  });
}
