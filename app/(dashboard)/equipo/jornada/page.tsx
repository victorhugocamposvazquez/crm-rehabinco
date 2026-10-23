import { redirect } from "next/navigation";
import { JornadaPanel } from "@/components/time/admin/JornadaPanel";
import { isAdmin, parseRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EquipoJornadaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAdmin(parseRole(perfil?.role))) redirect("/fichaje");

  return <JornadaPanel />;
}
