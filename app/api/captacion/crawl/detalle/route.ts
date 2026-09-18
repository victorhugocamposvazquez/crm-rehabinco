import { createClient } from "@/lib/supabase/server";
import { isAdmin, isComercial, parseRole } from "@/lib/auth/roles";
import { encolarJobDetalle } from "@/lib/captacion/crawl/enqueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const body = (await request.json()) as {
    portalId?: string;
    url?: string;
    alertaId?: string;
    externoId?: string;
  };
  if (!body.portalId || !body.url) {
    return Response.json({ ok: false, error: "portalId y url requeridos." }, { status: 400 });
  }

  const resultado = await encolarJobDetalle({
    portalId: body.portalId,
    url: body.url,
    alertaId: body.alertaId,
    externoId: body.externoId,
  });
  return Response.json(resultado, { status: resultado.ok ? 200 : 400 });
}
