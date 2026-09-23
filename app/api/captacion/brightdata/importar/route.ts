import { configBrightDataIdealista } from "@/lib/captacion/brightdata/config";
import { descargarSnapshot } from "@/lib/captacion/brightdata/disparar";
import { registrosBrightData } from "@/lib/captacion/brightdata/idealista";
import { ingestarIdealistaBrightData } from "@/lib/captacion/brightdata/ingestar";
import { sesionAdminCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Baja una recogida ya hecha en Bright Data (id j_...) y la guarda en Captación. */
export async function POST(request: Request) {
  const sesion = await sesionAdminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });

  const config = configBrightDataIdealista();
  if ("error" in config) return Response.json({ ok: false, error: config.error }, { status: 503 });

  let id = "";
  let desde = 0;
  try {
    const cuerpo = (await request.json()) as { id?: unknown; desde?: unknown };
    id = typeof cuerpo.id === "string" ? cuerpo.id.trim() : "";
    desde = typeof cuerpo.desde === "number" && Number.isFinite(cuerpo.desde) ? Math.max(0, Math.floor(cuerpo.desde)) : 0;
  } catch {
    return Response.json({ ok: false, error: "JSON no válido." }, { status: 400 });
  }
  if (!id.startsWith("j_")) {
    return Response.json({ ok: false, error: "Falta el id de la recogida." }, { status: 400 });
  }

  try {
    const snapshot = await descargarSnapshot(config.token, id);
    if (snapshot && typeof snapshot === "object" && "pendiente" in snapshot) {
      const esperaSegundos = (snapshot as { esperaSegundos?: number }).esperaSegundos ?? 20;
      return Response.json({ ok: true, pendiente: true, esperaSegundos });
    }
    const todos = registrosBrightData(snapshot);
    const lote = todos.slice(desde, desde + 80);
    const resultado = await ingestarIdealistaBrightData(lote, new Date().toISOString(), { paralelo: 8 });
    const siguiente = desde + lote.length;
    return Response.json({
      ok: resultado.errores.length === 0,
      ...resultado,
      total: todos.length,
      siguiente,
      queda: Math.max(0, todos.length - siguiente),
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo cargar la recogida." },
      { status: 502 }
    );
  }
}
