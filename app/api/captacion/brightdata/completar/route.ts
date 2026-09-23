import { configBrightDataIdealista, urlWebhookPublica } from "@/lib/captacion/brightdata/config";
import { dispararIdealista } from "@/lib/captacion/brightdata/disparar";
import { anuncioIdealistaVacio, urlFichaIdealista } from "@/lib/captacion/brightdata/idealista";
import { sesionAdminCaptacion } from "@/lib/captacion/portales/sesion";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Vuelve a pedir solo las fichas que llegaron sin título, precio ni foto. */
export async function POST(request: Request) {
  const sesion = await sesionAdminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });

  const config = configBrightDataIdealista();
  if ("error" in config) return Response.json({ ok: false, error: config.error }, { status: 503 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("captacion_anuncios")
    .select("titulo, precio, thumb, externo_id, url, contacto_telefono, fase")
    .eq("portal_id", "idealista")
    .in("fase", ["novedad", "contacto", "visita", "negociando"]);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  // Vacías (solo llegó el id) y con datos pero sin teléfono. Las completas no se piden.
  const pendientes = (data ?? []).filter((row) => anuncioIdealistaVacio(row) || !row.contacto_telefono);
  const urls = pendientes
    .map((row) => urlFichaIdealista(String(row.externo_id ?? ""), row.url))
    .filter((url): url is string => Boolean(url));
  const vacias = pendientes.filter((row) => anuncioIdealistaVacio(row)).length;
  const sinTelefono = pendientes.length - vacias;

  if (urls.length === 0) {
    return Response.json({ ok: true, fichas: 0, vacias, sinTelefono });
  }

  try {
    const { snapshotId } = await dispararIdealista(config, urlWebhookPublica(request), urls);
    return Response.json({ ok: true, fichas: urls.length, vacias, sinTelefono, snapshotId });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "No se han podido pedir las fichas." },
      { status: 502 }
    );
  }
}
