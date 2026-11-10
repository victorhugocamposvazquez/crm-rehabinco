"use server";

import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin, parseRole } from "@/lib/auth/roles";

type Result = { ok: true } | { ok: false; error: string };

async function sesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null as null, role: null as null };
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return { supabase, user, role: parseRole(perfil?.role) };
}

/** Envía el inmueble a la papelera (soft delete). Equipo. */
export async function enviarInmuebleAPapelera(id: string): Promise<Result> {
  const { supabase, user } = await sesion();
  if (!user) return { ok: false, error: "Debes iniciar sesión." };
  const { data, error } = await supabase
    .from("propiedades")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "No se ha podido enviar a la papelera." };
  return { ok: true };
}

/** Restaura un inmueble desde la papelera. Equipo. */
export async function restaurarInmueble(id: string): Promise<Result> {
  const { supabase, user } = await sesion();
  if (!user) return { ok: false, error: "Debes iniciar sesión." };
  const { data, error } = await supabase
    .from("propiedades")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "No se ha podido restaurar." };
  return { ok: true };
}

/** Borrado definitivo de un inmueble en papelera. Solo superadmin. */
export async function eliminarInmuebleDefinitivo(id: string): Promise<Result> {
  const { supabase, user, role } = await sesion();
  if (!user) return { ok: false, error: "Debes iniciar sesión." };
  if (!isSuperAdmin(role)) return { ok: false, error: "Solo el superadministrador puede vaciar la papelera." };
  const { data, error } = await supabase
    .from("propiedades")
    .delete()
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "No se ha podido eliminar definitivamente." };
  return { ok: true };
}

/** Vacía toda la papelera de inmuebles. Solo superadmin. */
export async function vaciarPapeleraInmuebles(): Promise<Result & { n?: number }> {
  const { supabase, user, role } = await sesion();
  if (!user) return { ok: false, error: "Debes iniciar sesión." };
  if (!isSuperAdmin(role)) return { ok: false, error: "Solo el superadministrador puede vaciar la papelera." };
  const { data, error } = await supabase
    .from("propiedades")
    .delete()
    .not("deleted_at", "is", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, n: data?.length ?? 0 };
}
