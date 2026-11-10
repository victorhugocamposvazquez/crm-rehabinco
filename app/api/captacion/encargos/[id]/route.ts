import { esEstadoCaptacion } from "@/lib/captacion/estados";
import { explorerStoreDesdeSesion, respuestaSesion } from "@/lib/catastro-host/from-request";
import { obtenerEncargo, reflejarEnPipeline } from "@/lib/captacion/encargos-db";
import { operacionDesdeApunte, prioridadDesdeApunte } from "@/lib/captacion/importar-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Contexto) {
  const { user, supabase } = await explorerStoreDesdeSesion();
  const sinSesion = respuestaSesion(user);
  if (sinSesion) return sinSesion;
  const { id } = await context.params;
  try {
    const ficha = await obtenerEncargo(supabase, id);
    if (!ficha) return Response.json({ ok: false, error: "Encargo no encontrado." }, { status: 404 });
    return Response.json({ ok: true, ...ficha });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se ha podido leer el encargo.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Contexto) {
  const { user, supabase } = await explorerStoreDesdeSesion();
  const sinSesion = respuestaSesion(user);
  if (sinSesion) return sinSesion;
  if (!user) return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  const { id } = await context.params;

  let cuerpo: Record<string, unknown> = {};
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const actual = await obtenerEncargo(supabase, id);
  if (!actual) return Response.json({ ok: false, error: "Encargo no encontrado." }, { status: 404 });

  const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof cuerpo.estado === "string") {
    if (!esEstadoCaptacion(cuerpo.estado)) {
      return Response.json({ ok: false, error: "Estado no válido." }, { status: 400 });
    }
    cambios.estado = cuerpo.estado;
  }
  if (typeof cuerpo.proximaAccion === "string") cambios.proxima_accion = cuerpo.proximaAccion.trim() || null;
  if (typeof cuerpo.proximaAccionEn === "string") cambios.proxima_accion_en = cuerpo.proximaAccionEn.trim() || null;
  if (typeof cuerpo.resultado === "string") cambios.resultado = cuerpo.resultado.trim() || null;
  if (typeof cuerpo.notasRevision === "string") cambios.notas_revision = cuerpo.notasRevision.trim() || null;
  if (typeof cuerpo.contactoNombre === "string") cambios.contacto_nombre = cuerpo.contactoNombre.trim() || null;
  if (typeof cuerpo.telefono === "string") cambios.telefono = cuerpo.telefono.trim() || null;
  if (typeof cuerpo.email === "string") cambios.email = cuerpo.email.trim() || null;
  if (typeof cuerpo.operacion === "string") cambios.operacion = operacionDesdeApunte(cuerpo.operacion);
  if (typeof cuerpo.prioridad === "string") cambios.prioridad = prioridadDesdeApunte(cuerpo.prioridad);

  const { error } = await supabase.from("captacion_encargos").update(cambios).eq("id", id);
  if (error) return Response.json({ ok: false, error: "No se ha podido guardar el encargo." }, { status: 500 });

  if (typeof cambios.estado === "string" && cambios.estado !== actual.encargo.estado) {
    await supabase.from("captacion_encargo_actividad").insert({
      encargo_id: id,
      actor_id: user.id,
      tipo: "estado",
      detalle: `Estado: ${actual.encargo.estado} → ${cambios.estado}`,
    });
  }

  const ficha = await obtenerEncargo(supabase, id);
  if (ficha?.encargo.fincaReference) {
    try {
      await reflejarEnPipeline(supabase, ficha.encargo, user.id);
    } catch {
      return Response.json({
        ok: true,
        ...ficha,
        aviso: "El encargo se ha guardado. El pipeline de la finca no se ha podido actualizar.",
      });
    }
  }
  return Response.json({ ok: true, ...(ficha ?? {}) });
}
