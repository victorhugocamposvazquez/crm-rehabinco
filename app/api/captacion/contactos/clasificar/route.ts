import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin, isComercial, parseRole } from "@/lib/auth/roles";
import { claveContactoCanonica } from "@/lib/captacion/contacto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = parseRole(perfil?.role);
  if (!isAdmin(role) && !isComercial(role)) {
    return Response.json({ ok: false, error: "Sin permiso." }, { status: 403 });
  }

  const body = (await request.json()) as { contactoClave?: string; clasificacion?: "particular" | "profesional" };
  const clave = claveContactoCanonica(body.contactoClave);
  if (!clave || !body.clasificacion) {
    return Response.json({ ok: false, error: "contactoClave y clasificacion requeridos." }, { status: 400 });
  }

  const admin = createAdminClient();
  const ahora = new Date().toISOString();
  const { error } = await admin.from("captacion_contactos").upsert(
    {
      clave,
      clasificacion_manual: body.clasificacion,
      clasificado_por: user.id,
      clasificado_en: ahora,
      updated_at: ahora,
    },
    { onConflict: "clave" }
  );
  if (error) return Response.json({ ok: false, error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
