import { cronPortalesAutorizado, ejecutarSyncPortales } from "@/lib/captacion/portales/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function ejecutar(request: Request): Promise<Response> {
  if (!cronPortalesAutorizado(request)) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  try {
    const resultado = await ejecutarSyncPortales();
    return Response.json(resultado, { status: resultado.ok ? 200 : 400 });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Error de sync." },
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
