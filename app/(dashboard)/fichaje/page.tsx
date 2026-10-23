import { redirect } from "next/navigation";
import { FichajePwa } from "@/components/time/FichajePwa";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FichajePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre_completo")
    .eq("id", user.id)
    .maybeSingle();

  const nombre = perfil?.nombre_completo ?? user.email ?? "Usuario";
  const iniciales = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase() ?? "")
    .join("");

  return <FichajePwa nombre={nombre} iniciales={iniciales || "RH"} />;
}
