import { guardarTelefonoManual } from "@/lib/captacion/brightdata/telefonos";
import { sesionCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const sesion = await sesionCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });
  const { id } = await context.params;
  let telefono = "";
  try {
    telefono = String(((await request.json()) as { telefono?: unknown }).telefono ?? "");
  } catch {
    telefono = "";
  }
  const resultado = await guardarTelefonoManual(id, telefono, sesion.user.id);
  if (!resultado.ok) return Response.json(resultado, { status: 400 });
  return Response.json({ ok: true });
}
