import { usuarioPorTokenExtension } from "@/lib/captacion/extension-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const usuario = await usuarioPorTokenExtension(request);
  if (!usuario) return Response.json({ ok: false, error: "No autorizado." }, { status: 401, headers: CORS });

  const ids = [...new Set((new URL(request.url).searchParams.get("ids") ?? "").split(",").map((id) => id.replace(/\D/g, "")).filter((id) => /^\d{5,}$/.test(id)))].slice(0, 80);
  if (ids.length === 0) return Response.json({ ok: true, anuncios: {} }, { headers: CORS });

  const { data, error } = await createAdminClient()
    .from("captacion_anuncios")
    .select("externo_id, contacto_telefono")
    .eq("portal_id", "idealista")
    .in("externo_id", ids);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });

  const anuncios: Record<string, { telefono: boolean }> = {};
  for (const fila of data ?? []) {
    if (typeof fila.externo_id !== "string") continue;
    anuncios[fila.externo_id] = { telefono: typeof fila.contacto_telefono === "string" && fila.contacto_telefono.length > 0 };
  }
  return Response.json({ ok: true, anuncios }, { headers: CORS });
}
