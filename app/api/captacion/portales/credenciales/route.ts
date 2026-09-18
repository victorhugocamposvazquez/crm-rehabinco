import {
  estadoCredencialesPortal,
  guardarCredencialesPortal,
  leerCredencialesPortal,
  PORTALES_API,
  type PortalApi,
} from "@/lib/captacion/portales/credenciales";
import { probarIdealista } from "@/lib/captacion/portales/legacy/idealista";
import { sesionSuperadminCaptacion } from "@/lib/captacion/portales/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esPortal(value: unknown): value is PortalApi {
  return PORTALES_API.includes(value as PortalApi);
}

export async function GET() {
  const sesion = await sesionSuperadminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });
  const portales = Object.fromEntries(
    await Promise.all(PORTALES_API.map(async (portal) => [portal, await estadoCredencialesPortal(portal)]))
  );
  return Response.json({ ok: true, portales });
}

export async function PUT(request: Request) {
  const sesion = await sesionSuperadminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });

  let cuerpo: {
    portal?: unknown;
    api_key?: unknown;
    api_secret?: unknown;
    borrar?: unknown;
  } = {};
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }
  if (!esPortal(cuerpo.portal)) {
    return Response.json({ ok: false, error: "Portal no válido." }, { status: 400 });
  }
  const resultado = await guardarCredencialesPortal(cuerpo.portal, {
    apiKey: typeof cuerpo.api_key === "string" ? cuerpo.api_key : null,
    apiSecret: typeof cuerpo.api_secret === "string" ? cuerpo.api_secret : null,
    borrar: cuerpo.borrar === true,
    userId: sesion.user.id,
  });
  if (!resultado.ok) return Response.json({ ok: false, error: resultado.error }, { status: 400 });
  return Response.json({ ok: true, portal: await estadoCredencialesPortal(cuerpo.portal) });
}

export async function POST(request: Request) {
  const sesion = await sesionSuperadminCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });

  let cuerpo: { portal?: unknown; api_key?: unknown; api_secret?: unknown } = {};
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }
  if (cuerpo.portal !== "idealista") {
    return Response.json(
      { ok: false, error: "Fotocasa aún no ofrece una API de lectura para comprobar." },
      { status: 400 }
    );
  }
  const typed = typeof cuerpo.api_key === "string" ? cuerpo.api_key.trim() : "";
  const secret = typeof cuerpo.api_secret === "string" ? cuerpo.api_secret.trim() : "";
  const guardadas = typed && secret ? { apiKey: typed, apiSecret: secret } : await leerCredencialesPortal("idealista");
  if (!guardadas) {
    return Response.json({ ok: false, error: "Pon primero la clave y el secreto." }, { status: 400 });
  }
  const prueba = await probarIdealista(guardadas.apiKey, guardadas.apiSecret);
  return Response.json(prueba, { status: prueba.ok ? 200 : 400 });
}
