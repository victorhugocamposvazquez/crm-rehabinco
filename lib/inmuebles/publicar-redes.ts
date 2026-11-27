import { createClient } from "@/lib/supabase/client";

export async function guardarPublicableRedes(id: string, valor: boolean): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase.from("propiedades").update({ publicar_redes: valor }).eq("id", id);
  return error?.message ?? null;
}
