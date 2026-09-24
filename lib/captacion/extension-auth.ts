import { createAdminClient } from "@/lib/supabase/admin";

export async function usuarioPorTokenExtension(request: Request): Promise<{ id: string; nombre: string | null } | null> {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token.length < 20) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, nombre_completo").eq("token_extension", token).maybeSingle();
  if (!data?.id) return null;
  return { id: String(data.id), nombre: data.nombre_completo == null ? null : String(data.nombre_completo) };
}
