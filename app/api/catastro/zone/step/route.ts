import { responderZonaPaso } from "@/lib/catastro/search-zone";
import { explorerStoreDesdeSesion, respuestaRastreoDesdeSesion } from "@/lib/catastro-host/from-request";
import { after } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Cada paso trabaja ≤ 25 s (ZONE_STEP_MAX_BUDGET_MS) más el margen de las peticiones en vuelo. */
export const maxDuration = 120;

export async function POST(request: Request) {
  const { user, role, store, archive } = await explorerStoreDesdeSesion();
  const bloqueo = respuestaRastreoDesdeSesion(user, role);
  if (bloqueo) return bloqueo;
  return responderZonaPaso(request, user, {
    explorerStore: store,
    archive,
    diferir: (tarea) => {
      after(() => {
        void tarea();
      });
    },
  });
}
