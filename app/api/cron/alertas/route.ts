import { cronAutorizado } from "@/lib/alertas/config";
import { dispararDigestAlertas } from "@/lib/alertas/disparar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function ejecutar(request: Request): Promise<Response> {
  if (!cronAutorizado(request)) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  try {
    const resultado = await dispararDigestAlertas();
    return Response.json(resultado);
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
