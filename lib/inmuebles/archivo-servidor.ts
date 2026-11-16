import { ROLES_EQUIPO } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

const ROLES = new Set<string>(ROLES_EQUIPO);

export async function exigirEquipoArchivo() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null as null, error: "No autorizado." };
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = perfil?.role;
  if (typeof role !== "string" || !ROLES.has(role)) {
    return { supabase, user: null as null, error: "No autorizado." };
  }
  return { supabase, user, error: null as null };
}
