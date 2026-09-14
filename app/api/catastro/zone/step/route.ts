import { responderZonaPaso } from "@/lib/catastro/search-zone";
import { explorerStoreDesdeSesion, respuestaRastreoDesdeSesion } from "@/lib/catastro-host/from-request";
import { programarTickZona } from "@/lib/catastro-host/zone-tick";
import { after } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Cada paso trabaja ≤ 25 s (ZONE_STEP_MAX_BUDGET_MS) más el margen de las peticiones en vuelo. */
export const maxDuration = 120;

export async function POST(request: Request) {
  const { user, role, store, archive } = await explorerStoreDesdeSesion();
  const bloqueo = respuestaRastreoDesdeSesion(user, role);
  if (bloqueo) return bloqueo;
  const clon = request.clone();
  const respuesta = await responderZonaPaso(request, user, {
    explorerStore: store,
    archive,
    diferir: (tarea) => {
      after(() => {
        void tarea();
      });
    },
  });
  try {
    const cuerpo = (await clon.json()) as { zoneSearchId?: unknown };
    if (typeof cuerpo.zoneSearchId === "string" && cuerpo.zoneSearchId.trim()) {
      programarTickZona(cuerpo.zoneSearchId.trim());
    }
  } catch {
    // el paso del navegador ya persistió; el cron cubre el resto
  }
  return respuesta;
}
