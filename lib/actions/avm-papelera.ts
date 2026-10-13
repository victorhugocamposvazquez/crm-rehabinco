"use server";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

async function cliente() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null as null };
  return { supabase, user };
}

export async function enviarValoracionAPapelera(id: string): Promise<Result> {
  const { supabase, user } = await cliente();
  if (!user) return { ok: false, error: "Debes iniciar sesión." };
  const { data, error } = await supabase
    .from("avm_valuations")
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "No se ha podido enviar a la papelera." };
  return { ok: true };
}

export async function restaurarValoracion(id: string): Promise<Result> {
  const { supabase, user } = await cliente();
  if (!user) return { ok: false, error: "Debes iniciar sesión." };
  const { error } = await supabase
    .from("avm_valuations")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id)
    .not("deleted_at", "is", null);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function eliminarValoracionDefinitiva(id: string): Promise<Result> {
  const { supabase, user } = await cliente();
  if (!user) return { ok: false, error: "Debes iniciar sesión." };
  const { error } = await supabase.from("avm_valuations").delete().eq("id", id).not("deleted_at", "is", null);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
