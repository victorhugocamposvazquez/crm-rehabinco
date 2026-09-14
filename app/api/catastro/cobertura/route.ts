import { isAdmin } from "@/lib/auth/roles";
import { agregarCoberturaTerritorio } from "@/lib/captacion/cobertura";
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
    .select("mode, criteria, coverage, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) {
    return Response.json({ ok: false, error: "No se ha podido leer la cobertura." }, { status: 500 });
  }

  const filas = agregarCoberturaTerritorio(
    (data ?? []).map((row) => {
      const criteria = (row.criteria ?? {}) as {
        mode?: string;
        postalCode?: string;
        municipio?: string;
        provincia?: string;
      };
      const coverage = (row.coverage ?? {}) as {
        streetsFound?: number;
        streetsProcessed?: number;
        complete?: boolean;
      };
      return {
        mode: String(row.mode ?? criteria.mode ?? ""),
        postalCode: criteria.postalCode,
        municipio: criteria.municipio,
        provincia: criteria.provincia,
        streetsFound: coverage.streetsFound,
        streetsProcessed: coverage.streetsProcessed,
        complete: coverage.complete,
        status: row.status,
        updatedAt: row.updated_at,
      };
    })
  );

  return Response.json({ ok: true, cobertura: filas });
}
