import { identidadFinca } from "@/lib/catastro/explorer";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { user, properties } = await explorerStoreDesdeSesion();
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }

  const refs = new URL(request.url).searchParams.get("refs") ?? "";
  const fincaReferences = [
    ...new Set(
      refs
        .split(",")
        .map((item) => identidadFinca(item.trim()))
        .filter((item): item is string => Boolean(item))
    ),
  ];
  const links = await properties.findLinksByFincaReferences(fincaReferences);
  return Response.json({ ok: true, links });
}
