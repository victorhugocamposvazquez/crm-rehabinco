import { createClient } from "@/lib/supabase/client";

export type PerfilEquipo = {
  id: string;
  nombre: string;
  email: string | null;
  color: string | null;
};

export async function cargarPerfilesEquipo(): Promise<PerfilEquipo[]> {
  const supabase = createClient();
  const { data } = await supabase.from("profiles").select("id, nombre_completo, email, color");
  return (data ?? []).map((perfil) => ({
    id: perfil.id,
    nombre: perfil.nombre_completo?.trim() || perfil.email || "",
    email: perfil.email,
    color: perfil.color,
  }));
}

export function mapaPerfiles(perfiles: PerfilEquipo[]) {
  return new Map(perfiles.map((perfil) => [perfil.id, perfil] as const));
}
