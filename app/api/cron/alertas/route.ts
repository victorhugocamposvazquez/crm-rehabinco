import { cronAutorizado } from "@/lib/alertas/config";
import { dispararDigestAlertas } from "@/lib/alertas/disparar";
import { dispararVentanaAlertas } from "@/lib/alertas/ventana";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function ejecutar(request: Request): Promise<Response> {
  if (!cronAutorizado(request)) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const solo = new URL(request.url).searchParams.get("solo");
  try {
    if (solo === "ventana") {
      return Response.json(await dispararVentanaAlertas());
    }
    const [digest, ventana] = await Promise.all([dispararDigestAlertas(), dispararVentanaAlertas()]);
    return Response.json({ ok: true, digest, ventana });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Error de avisos." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return ejecutar(request);
}

export async function POST(request: Request) {
  return ejecutar(request);
}
