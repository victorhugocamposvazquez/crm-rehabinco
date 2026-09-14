import { getCatastroClient } from "@/lib/catastro/client";
import { CATASTRO_USER_AGENT } from "@/lib/catastro/constants";
import { parsearCoordenadasCpmrc } from "@/lib/catastro/coordenadas";
import { identidadFinca } from "@/lib/catastro/explorer";
import {
  crearUrlMapaCatastral,
  crearUrlWmsCatastral,
  esBytesImagenCartografia,
} from "@/lib/catastro/explorer/catastro-map";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const WMS_TIMEOUT_MS = 10_000;

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
      const imagen = await descargarImagenWms(imageUrl);
      if (!imagen) {
        return Response.json({ ok: false, error: "No se ha podido cargar el mapa catastral." }, { status: 502 });
      }
      return new Response(imagen.bytes, {
        headers: {
          "content-type": imagen.contentType,
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

async function descargarImagenWms(
  imageUrl: string
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  for (let intento = 0; intento < 2; intento += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WMS_TIMEOUT_MS);
    try {
      const wms = await fetch(imageUrl, {
        headers: { Accept: "image/png", "User-Agent": CATASTRO_USER_AGENT },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!wms.ok) continue;
      const bytes = await wms.arrayBuffer();
      const contentType = wms.headers.get("content-type") || "image/png";
      if (!esBytesImagenCartografia(bytes, contentType)) continue;
      return { bytes, contentType: contentType.includes("image/") ? contentType : "image/png" };
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
