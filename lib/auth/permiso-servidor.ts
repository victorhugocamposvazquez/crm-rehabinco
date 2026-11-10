import { createClient } from "@/lib/supabase/server";
import { parseRole } from "@/lib/auth/roles";
import { activoDe, type FilaPermiso, type PermisoId } from "@/lib/auth/permisos";

export async function permisoDeSesion(id: PermisoId): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = parseRole(perfil?.role);
  const { data, error } = await supabase.from("role_permisos").select("role, permiso, activo").eq("role", role);
  const filas = error ? null : ((data ?? []) as FilaPermiso[]);
  return activoDe(role, id, filas);
}
