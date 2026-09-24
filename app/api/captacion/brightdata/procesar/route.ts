import { procesarPaginasPendientes } from "@/lib/captacion/brightdata/paginas";
import { cronAutorizado } from "@/lib/alertas/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!cronAutorizado(request)) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  try {
    const resultado = await procesarPaginasPendientes(20);
    return Response.json({ ok: true, ...resultado });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "No se han podido procesar las páginas." },
      { status: 502 }
    );
  }
}
