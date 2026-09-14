import {
  cronZonaAutorizado,
  tickZonasPendientes,
} from "@/lib/catastro-host/zone-tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function ejecutar(request: Request): Promise<Response> {
  if (!cronZonaAutorizado(request)) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  let zoneSearchId: string | undefined;
  if (request.method === "POST") {
    try {
      const cuerpo = (await request.json()) as { zoneSearchId?: unknown };
      if (typeof cuerpo.zoneSearchId === "string" && cuerpo.zoneSearchId.trim()) {
        zoneSearchId = cuerpo.zoneSearchId.trim();
      }
    } catch {
      // cron GET no trae cuerpo
    }
  }
  const resultado = await tickZonasPendientes(zoneSearchId);
  return Response.json({ ok: true, ...resultado });
}

export async function GET(request: Request) {
  return ejecutar(request);
}

export async function POST(request: Request) {
  return ejecutar(request);
}
