import { identidadFinca } from "@/lib/catastro/explorer";
import { fincaUiDesdeRecord } from "@/lib/catastro/explorer/history-ui";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fincaReference: string }> }
) {
  const { user, store, properties } = await explorerStoreDesdeSesion();
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }

  const { fincaReference: bruto } = await context.params;
  const fincaReference = identidadFinca(bruto ?? "");
  if (!fincaReference) {
    return Response.json({ ok: false, error: "Finca no encontrada." }, { status: 404 });
  }

  const finca = await store.getFinca(fincaReference);
  if (!finca) {
    return Response.json({ ok: false, error: "Finca no encontrada." }, { status: 404 });
  }

  const [review, links] = await Promise.all([
    store.getReview(user.id, fincaReference),
    properties.findLinksByFincaReference(fincaReference),
  ]);
  return Response.json({
    ok: true,
    finca: fincaUiDesdeRecord(finca),
    lastSeenAt: finca.lastSeenAt ?? null,
    review,
    links,
  });
}
