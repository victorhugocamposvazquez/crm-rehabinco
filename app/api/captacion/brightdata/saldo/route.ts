import { configBrightDataIdealista } from "@/lib/captacion/brightdata/config";
import { leerGastoBrightData } from "@/lib/captacion/brightdata/saldo";
import { sesionSuperadminCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await sesionSuperadminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });
  const config = configBrightDataIdealista();
  if ("error" in config) return Response.json({ ok: false, error: config.error }, { status: 503 });
  const gasto = await leerGastoBrightData(config.token);
  return Response.json({ ok: true, ...gasto });
}
