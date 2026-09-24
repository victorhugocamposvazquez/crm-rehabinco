import { waitUntil } from "@vercel/functions";
import { ejecutarRafagaProcesar } from "@/lib/captacion/brightdata/rafagas";
import { cronAutorizado } from "@/lib/alertas/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!cronAutorizado(request)) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  waitUntil(ejecutarRafagaProcesar(20));
  return Response.json({ ok: true, encolado: true }, { status: 202 });
}
