import { isEditor, parseRole, type Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export async function sesionCaptacion(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string }; role: Role }
  | { ok: false; status: 401 | 403; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "No autorizado." };
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = parseRole(perfil?.role);
  if (isEditor(role)) return { ok: false, status: 403, error: "Sin acceso." };
  return { ok: true, supabase, user: { id: user.id }, role };
}
