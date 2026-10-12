import { avmCronAutorizado } from "@/lib/avm/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Revaloración masiva (cron mensual). Implementación del batch en fase posterior. */
export async function POST(request: Request) {
  if (!avmCronAutorizado(request)) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  return Response.json(
    { ok: false, error: "Revaloración masiva aún no implementada en esta versión." },
    { status: 501 },
  );
}
