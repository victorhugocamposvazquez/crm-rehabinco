import { waitUntil } from "@vercel/functions";
import { ejecutarRafagaProcesar } from "@/lib/captacion/brightdata/rafagas";
import { lockProcesarActivo } from "@/lib/captacion/brightdata/procesar-lock";
import { sesionSuperadminCaptacion } from "@/lib/captacion/portales/sesion";
import { cronAutorizado } from "@/lib/alertas/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (cronAutorizado(request)) {
    waitUntil(ejecutarRafagaProcesar(20));
    return Response.json({ ok: true, encolado: true }, { status: 202 });
  }
  const sesion = await sesionSuperadminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });
  if (await lockProcesarActivo()) {
    return Response.json({ ok: false, error: "Hay una ráfaga en curso." }, { status: 409 });
  }
  const resultado = await ejecutarRafagaProcesar(20);
  return Response.json({ ok: true, ...resultado });
}
