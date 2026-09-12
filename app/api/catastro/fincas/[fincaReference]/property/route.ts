import { puedeCrearPropiedad } from "@/lib/auth/roles";
import {
  ERRORES_VINCULO_HTTP,
  crearOReutilizarPropiedad,
  identidadFinca,
} from "@/lib/catastro/explorer";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ fincaReference: string }> }
) {
  const { user, role, store, properties } = await explorerStoreDesdeSesion();
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }

  const { fincaReference: bruto } = await context.params;
  const fincaReference = identidadFinca(bruto ?? "");
  if (!fincaReference) {
    return Response.json({ ok: false, error: ERRORES_VINCULO_HTTP.NOT_FOUND.error }, { status: 404 });
  }

  let ofertanteId: string | null = null;
  try {
    const cuerpo = (await request.json()) as { ofertanteId?: unknown };
    if (typeof cuerpo.ofertanteId === "string") ofertanteId = cuerpo.ofertanteId;
  } catch {
    ofertanteId = null;
  }

  const resultado = await crearOReutilizarPropiedad(store, properties, {
    fincaReference,
    userId: user.id,
    now: new Date().toISOString(),
    puedeCrear: puedeCrearPropiedad(role),
    ofertanteId,
  });

  if (!resultado.ok) {
    const mapped = ERRORES_VINCULO_HTTP[resultado.error];
    return Response.json({ ok: false, error: mapped.error }, { status: mapped.status });
  }

  return Response.json({
    ok: true,
    created: resultado.created,
    link: resultado.link,
  });
}
