import { createClient } from "@/lib/supabase/server";
import { isAdmin, parseRole } from "@/lib/auth/roles";
import { ejecutarVolcadoIdealista } from "@/lib/inmuebles/idealista-publicacion/ejecutar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function adminAutorizado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!isAdmin(parseRole(perfil?.role))) return null;
  return user;
}

/** Vista previa del feed (sin FTP). */
export async function GET() {
  if (!(await adminAutorizado())) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const resultado = await ejecutarVolcadoIdealista({ soloVistaPrevia: true });
  return Response.json(resultado, { status: resultado.ok || resultado.feed ? 200 : 400 });
}

/** Sube el feed al FTP de Idealista. */
export async function POST() {
  if (!(await adminAutorizado())) {
    return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const resultado = await ejecutarVolcadoIdealista();
  return Response.json(resultado, { status: resultado.ok ? 200 : 400 });
}
