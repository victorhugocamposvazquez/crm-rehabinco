import { configBrightDataIdealista, urlWebhookPublica } from "@/lib/captacion/brightdata/config";
import { dispararIdealista } from "@/lib/captacion/brightdata/disparar";
import { urlFichaIdealista } from "@/lib/captacion/brightdata/idealista";
import { sesionAdminCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Pide la ficha solo de los externo_id que manda el botón. Máximo 10. */
export async function POST(request: Request) {
  const sesion = await sesionAdminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });

  const config = configBrightDataIdealista();
  if ("error" in config) return Response.json({ ok: false, error: config.error }, { status: 503 });

  let ids: string[] = [];
  try {
    const cuerpo = (await request.json()) as { externo_ids?: unknown };
    if (!Array.isArray(cuerpo.externo_ids)) {
      return Response.json({ ok: false, error: "Falta externo_ids." }, { status: 400 });
    }
    ids = [...new Set(cuerpo.externo_ids.map((id) => String(id).replace(/\D/g, "")).filter((id) => /^\d{5,}$/.test(id)))];
  } catch {
    return Response.json({ ok: false, error: "JSON no válido." }, { status: 400 });
  }
  if (ids.length === 0) return Response.json({ ok: false, error: "Ningún anuncio válido." }, { status: 400 });
  if (ids.length > 10) return Response.json({ ok: false, error: "Máximo 10 fichas por llamada." }, { status: 400 });

  const urls = ids.map((id) => urlFichaIdealista(id)).filter((url): url is string => Boolean(url));
  try {
    const { snapshotId } = await dispararIdealista(config, urlWebhookPublica(request), urls, config.fichaCollectorId);
    return Response.json({ ok: true, fichas: urls.length, snapshotId });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "No se ha podido pedir la ficha." },
      { status: 502 }
    );
  }
}
