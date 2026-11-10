import { usuarioPorTokenExtension } from "@/lib/captacion/extension-auth";
import { sesionCaptacion } from "@/lib/captacion/portales/sesion";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Marca un anuncio como retirado del portal.
 * Sesión CRM (id) o extensión (externo_id + portal_id).
 */
export async function POST(request: Request) {
  const extension = await usuarioPorTokenExtension(request);
  const sesion = extension ? null : await sesionCaptacion();
  if (!extension && !sesion?.ok) {
    const err = sesion && !sesion.ok ? sesion : { error: "No autorizado.", status: 401 };
    return Response.json({ ok: false, error: err.error }, { status: err.status, headers: CORS });
  }

  let body: { id?: string; externo_id?: string; portal_id?: string; motivo?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400, headers: CORS });
  }

  const admin = createAdminClient();
  const ahora = new Date().toISOString();
  let anuncioId: string | null = typeof body.id === "string" ? body.id : null;
  let externoId: string | null = null;

  if (!anuncioId) {
    const externo = String(body.externo_id ?? "").replace(/\D/g, "");
    const portal = typeof body.portal_id === "string" && body.portal_id.trim() ? body.portal_id.trim() : "idealista";
    if (!/^\d{5,}$/.test(externo)) {
      return Response.json({ ok: false, error: "Falta id o externo_id." }, { status: 400, headers: CORS });
    }
    externoId = externo;
    const { data } = await admin
      .from("captacion_anuncios")
      .select("id, desaparecido_en")
      .eq("portal_id", portal)
      .eq("externo_id", externo)
      .maybeSingle();
    if (!data?.id) {
      return Response.json({ ok: true, already: false, found: false }, { headers: CORS });
    }
    if (data.desaparecido_en) {
      return Response.json({ ok: true, already: true, id: data.id }, { headers: CORS });
    }
    anuncioId = String(data.id);
  }

  const { data: fila } = await admin
    .from("captacion_anuncios")
    .select("id, desaparecido_en")
    .eq("id", anuncioId)
    .maybeSingle();
  if (!fila) {
    return Response.json({ ok: false, error: "Anuncio no encontrado." }, { status: 404, headers: CORS });
  }
  if (fila.desaparecido_en) {
    return Response.json({ ok: true, already: true, id: anuncioId }, { headers: CORS });
  }

  const { error } = await admin
    .from("captacion_anuncios")
    .update({ desaparecido_en: ahora, updated_at: ahora })
    .eq("id", anuncioId);
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
  }

  const actorId = extension?.id ?? (sesion && sesion.ok ? sesion.user.id : null);
  const motivo =
    typeof body.motivo === "string" && body.motivo.trim()
      ? body.motivo.trim().slice(0, 200)
      : extension
        ? "Retirado detectado en Idealista (extensión)"
        : "Marcado retirado desde el CRM";
  if (actorId) {
    await admin.from("captacion_anuncios_actividad").insert({
      anuncio_id: anuncioId,
      actor_id: actorId,
      tipo: "retirado",
      detalle: motivo,
    });
  }

  return Response.json(
    { ok: true, already: false, id: anuncioId, externo_id: externoId, desaparecido_en: ahora },
    { headers: CORS }
  );
}
