import { z } from "zod";
import { cronAutorizado } from "@/lib/alertas/config";
import { rastrearMercado } from "@/lib/avm/crawl/market-listings-crawl";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

const cuerpo = z
  .object({
    municipality_code: z.string().regex(/^\d{5}$/).optional(),
    portal: z.enum(["fotocasa", "habitaclia", "pisos"]).optional(),
    operation: z.enum(["sale", "rent"]).optional(),
  })
  .strict();

/** Pasada de tarjetas. Sin cuerpo recorre los objetivos activos. Idealista no entra aquí. */
export async function POST(request: Request) {
  if (!cronAutorizado(request)) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const json = await request.json().catch(() => ({}));
  const parsed = cuerpo.safeParse(json);
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Cuerpo no válido" }, { status: 400 });
  }
  const informes = await rastrearMercado(createAdminClient(), {
    municipalityCode: parsed.data.municipality_code,
    portal: parsed.data.portal,
    operation: parsed.data.operation,
  });
  return Response.json({ ok: true, informes });
}
