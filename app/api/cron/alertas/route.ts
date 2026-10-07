import { cronAutorizadoAvisos } from "@/lib/alertas/secretos";
import { dispararMananaAlertas } from "@/lib/alertas/manana";
import { dispararVentanaAlertas } from "@/lib/alertas/ventana";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function ejecutar(request: Request): Promise<Response> {
  if (!(await cronAutorizadoAvisos(request))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const solo = new URL(request.url).searchParams.get("solo");
  try {
    const [ventana, manana] = await Promise.all([dispararVentanaAlertas(), dispararMananaAlertas()]);
    return Response.json({ ok: true, solo, ventana, manana });
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
