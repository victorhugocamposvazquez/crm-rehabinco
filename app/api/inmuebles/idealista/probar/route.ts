import { createClient } from "@/lib/supabase/server";
import { isAdmin, parseRole } from "@/lib/auth/roles";
import { tokenPublicacionIdealista } from "@/lib/inmuebles/idealista-publicacion/api";
import { leerConfigIdealistaPublicacion } from "@/lib/inmuebles/idealista-publicacion/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAdmin(parseRole(perfil?.role))) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  let cuerpo: { apiClientId?: unknown; apiClientSecret?: unknown } = {};
  try {
    cuerpo = (await request.json()) as { apiClientId?: unknown; apiClientSecret?: unknown };
  } catch {
    cuerpo = {};
  }

  const guardada = await leerConfigIdealistaPublicacion();
  const clientId = (typeof cuerpo.apiClientId === "string" ? cuerpo.apiClientId.trim() : "") || guardada.apiClientId;
  const clientSecret =
    (typeof cuerpo.apiClientSecret === "string" ? cuerpo.apiClientSecret.trim() : "") || guardada.apiClientSecret;
  if (!clientId || !clientSecret) {
    return Response.json(
      { ok: false, error: "Faltan el cliente y el secreto que envíe Idealista." },
      { status: 400 }
    );
  }

  try {
    await tokenPublicacionIdealista(clientId, clientSecret);
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "No se ha podido conectar." },
      { status: 400 }
    );
  }

  return Response.json({
    ok: true,
    mensaje: guardada.apiBaseUrl
      ? "Credenciales aceptadas. Ya se puede publicar."
      : "Credenciales aceptadas. Falta la URL base de la API para publicar.",
  });
}
