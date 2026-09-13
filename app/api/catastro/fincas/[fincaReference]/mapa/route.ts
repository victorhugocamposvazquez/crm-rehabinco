import { getCatastroClient } from "@/lib/catastro/client";
import { CATASTRO_USER_AGENT } from "@/lib/catastro/constants";
import { parsearCoordenadasCpmrc } from "@/lib/catastro/coordenadas";
import { identidadFinca } from "@/lib/catastro/explorer";
import { crearUrlMapaCatastral, crearUrlWmsCatastral } from "@/lib/catastro/explorer/catastro-map";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ fincaReference: string }> }
) {
  const { user } = await explorerStoreDesdeSesion();
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }

  const { fincaReference: bruto } = await context.params;
  const fincaReference = identidadFinca(bruto ?? "");
  if (!fincaReference) {
    return Response.json({ ok: false, error: "Finca no encontrada." }, { status: 404 });
  }

  const quiereImagen = new URL(request.url).searchParams.get("img") === "1";

  try {
    const raw = await getCatastroClient().consultarCoordenadasPorReferencia(fincaReference);
    const geo = parsearCoordenadasCpmrc(raw);
    const imageUrl = geo ? crearUrlWmsCatastral(geo) : null;
    if (!imageUrl) {
      return Response.json(
        { ok: false, error: "Catastro no ha localizado la cartografía de esa parcela." },
        { status: 404 }
      );
    }
    if (quiereImagen) {
      const wms = await fetch(imageUrl, {
        headers: { Accept: "image/png", "User-Agent": CATASTRO_USER_AGENT },
        cache: "no-store",
      });
      if (!wms.ok) {
        return Response.json({ ok: false, error: "No se ha podido cargar el mapa catastral." }, { status: 502 });
      }
      return new Response(wms.body, {
        headers: {
          "content-type": wms.headers.get("content-type") || "image/png",
          "cache-control": "private, max-age=3600",
        },
      });
    }
    return Response.json({
      ok: true,
      imageUrl,
      mapaUrl: crearUrlMapaCatastral(fincaReference),
    });
  } catch {
    return Response.json(
      { ok: false, error: "No se ha podido cargar el mapa catastral." },
      { status: 502 }
    );
  }
}
