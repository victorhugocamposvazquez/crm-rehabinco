import { avmCronAutorizado } from "@/lib/avm/cron-auth";
import { evaluarCaducidadCapa, type AvmDataLayer } from "@/lib/avm/data-health";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function responder(request: Request): Promise<Response> {
  if (!avmCronAutorizado(request)) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const db = createAdminClient();
  const { data, error } = await db.rpc("avm_data_health");
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  const rows = (Array.isArray(data) ? data : data ? JSON.parse(JSON.stringify(data)) : []) as {
    layer: AvmDataLayer;
    loaded_at: string | null;
  }[];
  const layers = rows.map((row) => {
    const check = evaluarCaducidadCapa(row.layer, row.loaded_at ?? null);
    return { ...row, stale: check.stale, maxMonths: check.maxMonths };
  });
  const stale = layers.some((l) => l.stale);
  return Response.json({ ok: !stale, service: "avm", stale, layers });
}

export async function GET(request: Request) {
  return responder(request);
}

export async function POST(request: Request) {
  return responder(request);
}
