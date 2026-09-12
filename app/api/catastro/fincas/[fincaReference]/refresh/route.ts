import { actualizarDatosDesdeCatastro, identidadFinca } from "@/lib/catastro/explorer";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Localiza la CatastroFinca persistida. No consulta Catastro. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ fincaReference: string }> }
) {
  const { user, store } = await explorerStoreDesdeSesion();
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }

  const { fincaReference: bruto } = await context.params;
  const fincaReference = identidadFinca(bruto ?? "");
  if (!fincaReference) {
    return Response.json({ ok: false, error: "Finca no encontrada." }, { status: 404 });
  }

  const resultado = await actualizarDatosDesdeCatastro(store, fincaReference, new Date().toISOString());
  if (!resultado.ok) {
    return Response.json({ ok: false, error: "Finca no encontrada." }, { status: 404 });
  }
  return Response.json(resultado);
}
