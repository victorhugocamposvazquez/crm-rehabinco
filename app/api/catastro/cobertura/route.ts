import { isAdmin } from "@/lib/auth/roles";
import { agregarCoberturaTerritorio, busquedaCoberturaDesdeFila } from "@/lib/captacion/cobertura";
import { explorerStoreDesdeSesion, respuestaSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { user, role, supabase } = await explorerStoreDesdeSesion();
  const sinSesion = respuestaSesion(user);
  if (sinSesion) return sinSesion;
  if (!user || !isAdmin(role)) {
    return Response.json({ ok: false, error: "Solo dirección ve la cobertura." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("catastro_explorer_searches")
    .select("mode, postal_code, municipio, provincia, coverage, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("cobertura catastro", error.message);
    return Response.json({ ok: false, error: "No se ha podido leer la cobertura." }, { status: 500 });
  }

  const filas = agregarCoberturaTerritorio((data ?? []).map(busquedaCoberturaDesdeFila));

  return Response.json({ ok: true, cobertura: filas });
}
