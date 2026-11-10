import { explorerStoreDesdeSesion, respuestaSesion } from "@/lib/catastro-host/from-request";
import { tipoAnotacion } from "@/lib/captacion/encargos-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await explorerStoreDesdeSesion();
  const sinSesion = respuestaSesion(user);
  if (sinSesion) return sinSesion;
  if (!user) return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  const { id } = await context.params;

  let cuerpo: { tipo?: unknown; detalle?: unknown } = {};
  try {
    cuerpo = (await request.json()) as { tipo?: unknown; detalle?: unknown };
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }
  const tipo = tipoAnotacion(cuerpo.tipo);
  const detalle = typeof cuerpo.detalle === "string" ? cuerpo.detalle.trim() : "";
  if (!tipo) return Response.json({ ok: false, error: "Tipo de anotación no válido." }, { status: 400 });
  if (!detalle) return Response.json({ ok: false, error: "Escribe qué ha pasado." }, { status: 400 });

  const { error } = await supabase.from("captacion_encargo_actividad").insert({
    encargo_id: id,
    actor_id: user.id,
    tipo,
    detalle,
  });
  if (error) return Response.json({ ok: false, error: "No se ha podido anotar." }, { status: 500 });
  await supabase.from("captacion_encargos").update({ updated_at: new Date().toISOString() }).eq("id", id);
  return Response.json({ ok: true });
}
