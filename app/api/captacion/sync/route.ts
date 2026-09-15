import { createClient } from "@/lib/supabase/server";
import { isAdmin, parseRole } from "@/lib/auth/roles";
import { cronPortalesAutorizado, ejecutarSyncPortales } from "@/lib/captacion/portales/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (cronPortalesAutorizado(request)) {
    const resultado = await ejecutarSyncPortales();
    return Response.json(resultado, { status: resultado.ok ? 200 : 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAdmin(parseRole(perfil?.role))) {
    return Response.json({ ok: false, error: "Solo dirección puede actualizar." }, { status: 403 });
  }
  try {
    const resultado = await ejecutarSyncPortales();
    return Response.json(resultado, { status: resultado.ok ? 200 : 400 });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Error de sync." },
      { status: 500 }
    );
  }
}
