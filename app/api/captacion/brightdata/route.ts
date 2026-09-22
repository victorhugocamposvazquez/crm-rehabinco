import { configBrightDataIdealista, webhookAutorizado } from "@/lib/captacion/brightdata/config";
import { descargarSnapshot } from "@/lib/captacion/brightdata/disparar";
import { registrosBrightData, snapshotIdDe } from "@/lib/captacion/brightdata/idealista";
import { ingestarIdealistaBrightData } from "@/lib/captacion/brightdata/ingestar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const config = configBrightDataIdealista();
  if ("error" in config) {
    return Response.json({ ok: false, error: config.error }, { status: 503 });
  }
  if (!webhookAutorizado(request, config.webhookSecret)) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON no válido." }, { status: 400 });
  }

  let registros = registrosBrightData(cuerpo);
  if (registros.length === 0) {
    const snapshotId = snapshotIdDe(cuerpo);
    if (!snapshotId) {
      return Response.json({ ok: true, nuevos: 0, actualizados: 0, omitidos: 0 });
    }
    try {
      const snapshot = await descargarSnapshot(config.token, snapshotId);
      if (snapshot && typeof snapshot === "object" && "pendiente" in snapshot) {
        return Response.json({ ok: true, pendiente: true });
      }
      registros = registrosBrightData(snapshot);
    } catch (error) {
      return Response.json(
        { ok: false, error: error instanceof Error ? error.message : "No se pudo leer el snapshot." },
        { status: 502 }
      );
    }
  }

  try {
    const resultado = await ingestarIdealistaBrightData(registros);
    const status = resultado.errores.length > 0 ? 500 : 200;
    return Response.json({ ok: resultado.errores.length === 0, ...resultado }, { status });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Error al guardar." },
      { status: 500 }
    );
  }
}
