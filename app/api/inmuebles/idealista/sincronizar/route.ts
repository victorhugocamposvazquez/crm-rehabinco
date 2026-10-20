import { createClient } from "@/lib/supabase/server";
import { isAdmin, parseRole } from "@/lib/auth/roles";
import {
  sincronizarMarcadosIdealista,
  sincronizarPropiedadIdealista,
} from "@/lib/inmuebles/idealista-publicacion/sincronizar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });

  let cuerpo: { propiedadId?: unknown; todos?: unknown } = {};
  try {
    cuerpo = (await request.json()) as { propiedadId?: unknown; todos?: unknown };
  } catch {
    cuerpo = {};
  }

  if (cuerpo.todos === true) {
    const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!isAdmin(parseRole(perfil?.role))) {
      return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }
    const resultado = await sincronizarMarcadosIdealista();
    return Response.json(resultado, { status: resultado.ok ? 200 : 400 });
  }

  const propiedadId = typeof cuerpo.propiedadId === "string" ? cuerpo.propiedadId : "";
  if (!propiedadId) {
    return Response.json({ ok: false, error: "Falta el inmueble." }, { status: 400 });
  }
  const { data } = await supabase.from("propiedades").select("id").eq("id", propiedadId).maybeSingle();
  if (!data) return Response.json({ ok: false, error: "Inmueble no encontrado." }, { status: 404 });

  const resultado = await sincronizarPropiedadIdealista(propiedadId);
  return Response.json(resultado, { status: resultado.ok ? 200 : 400 });
}
