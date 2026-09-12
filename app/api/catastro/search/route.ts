/** Adaptador HTTP del host CRM. La sesión es del host; el dominio está en lib/catastro. */
import { responderBusquedaComercial } from "@/lib/catastro/search-commercial";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const { user, store } = await explorerStoreDesdeSesion();
  return responderBusquedaComercial(request, user, undefined, undefined, {
    explorerStore: store,
  });
}
