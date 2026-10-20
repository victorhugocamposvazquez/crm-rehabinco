import { createClient } from "@/lib/supabase/server";
import { isAdmin, parseRole } from "@/lib/auth/roles";
import {
  guardarConfigIdealistaPublicacion,
  leerConfigIdealistaPublicacion,
  configListaParaApi,
  configListaParaFtp,
} from "@/lib/inmuebles/idealista-publicacion/config";
import { ultimaEjecucionIdealista } from "@/lib/inmuebles/idealista-publicacion/ejecutar";
import { enmascararClave } from "@/lib/captacion/portales/credenciales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminAutorizado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAdmin(parseRole(perfil?.role))) return null;
  return user;
}

export async function GET() {
  if (!(await adminAutorizado())) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const cfg = await leerConfigIdealistaPublicacion();
  const ultima = await ultimaEjecucionIdealista();
  return Response.json({
    ok: true,
    config: {
      customerCode: cfg.customerCode,
      ftpHost: cfg.ftpHost,
      ftpPort: cfg.ftpPort,
      ftpUser: cfg.ftpUser,
      ftpSecure: cfg.ftpSecure,
      ftpPasswordHint: cfg.ftpPassword ? enmascararClave(cfg.ftpPassword) : null,
      contactName: cfg.contactName,
      contactEmail: cfg.contactEmail,
      contactPhone: cfg.contactPhone,
      apiClientId: cfg.apiClientId,
      apiClientSecretHint: cfg.apiClientSecret ? enmascararClave(cfg.apiClientSecret) : null,
      apiBaseUrl: cfg.apiBaseUrl,
      updatedAt: cfg.updatedAt,
      listoParaApi: configListaParaApi(cfg),
      listoParaFtp: configListaParaFtp(cfg),
    },
    ultimaEjecucion: ultima,
  });
}

export async function PUT(request: Request) {
  const user = await adminAutorizado();
  if (!user) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });

  let cuerpo: Record<string, unknown> = {};
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const resultado = await guardarConfigIdealistaPublicacion({
    customerCode: typeof cuerpo.customerCode === "string" ? cuerpo.customerCode : null,
    ftpHost: typeof cuerpo.ftpHost === "string" ? cuerpo.ftpHost : null,
    ftpPort: typeof cuerpo.ftpPort === "number" ? cuerpo.ftpPort : undefined,
    ftpUser: typeof cuerpo.ftpUser === "string" ? cuerpo.ftpUser : null,
    ftpPassword: typeof cuerpo.ftpPassword === "string" ? cuerpo.ftpPassword : null,
    ftpSecure: typeof cuerpo.ftpSecure === "boolean" ? cuerpo.ftpSecure : undefined,
    contactName: typeof cuerpo.contactName === "string" ? cuerpo.contactName : null,
    contactEmail: typeof cuerpo.contactEmail === "string" ? cuerpo.contactEmail : null,
    contactPhone: typeof cuerpo.contactPhone === "string" ? cuerpo.contactPhone : null,
    apiClientId: typeof cuerpo.apiClientId === "string" ? cuerpo.apiClientId : null,
    apiClientSecret: typeof cuerpo.apiClientSecret === "string" ? cuerpo.apiClientSecret : null,
    apiBaseUrl: typeof cuerpo.apiBaseUrl === "string" ? cuerpo.apiBaseUrl : null,
    userId: user.id,
  });

  if (!resultado.ok) return Response.json(resultado, { status: 400 });
  return Response.json({ ok: true });
}
