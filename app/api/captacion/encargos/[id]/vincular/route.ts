import { explorerStoreDesdeSesion, respuestaSesion } from "@/lib/catastro-host/from-request";
import { obtenerEncargo, reflejarEnPipeline, vincularFincaEncargo } from "@/lib/captacion/encargos-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, supabase } = await explorerStoreDesdeSesion();
  const sinSesion = respuestaSesion(user);
  if (sinSesion) return sinSesion;
  if (!user) return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  const { id } = await context.params;

  let cuerpo: { fincaReference?: unknown } = {};
  try {
    cuerpo = (await request.json()) as { fincaReference?: unknown };
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }
  const fincaReference = typeof cuerpo.fincaReference === "string" ? cuerpo.fincaReference : "";
  const actual = await obtenerEncargo(supabase, id);
  if (!actual) return Response.json({ ok: false, error: "Encargo no encontrado." }, { status: 404 });

  try {
    await vincularFincaEncargo(supabase, {
      encargoId: id,
      fincaReference,
      actorId: user.id,
      asignadoA: actual.encargo.asignadoA,
    });
    const ficha = await obtenerEncargo(supabase, id);
    if (ficha) await reflejarEnPipeline(supabase, ficha.encargo, user.id);
    return Response.json({ ok: true, ...(ficha ?? {}) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se ha podido vincular la finca.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
