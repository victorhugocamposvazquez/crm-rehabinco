import { persistirRevision } from "@/lib/catastro/explorer";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const { user, store } = await explorerStoreDesdeSesion();
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }

  let cuerpo: { fincaReference?: unknown; status?: unknown } = {};
  try {
    cuerpo = (await request.json()) as { fincaReference?: unknown; status?: unknown };
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const fincaReference =
    typeof cuerpo.fincaReference === "string" ? cuerpo.fincaReference.trim().toUpperCase() : "";
  const status = cuerpo.status === "REVIEW" || cuerpo.status === "NONE" ? cuerpo.status : null;
  if (fincaReference.length !== 14 || !status) {
    return Response.json({ ok: false, error: "Revisión inválida." }, { status: 400 });
  }

  const finca = await store.getFinca(fincaReference);
  if (!finca) {
    return Response.json({ ok: false, error: "La finca aún no está persistida." }, { status: 409 });
  }

  const review = await persistirRevision(store, {
    userId: user.id,
    fincaReference,
    status,
    now: new Date().toISOString(),
  });
  return Response.json({ ok: true, review });
}
