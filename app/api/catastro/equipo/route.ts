import { isAdmin } from "@/lib/auth/roles";
import { filaCaptacionDesdeAssignment } from "@/lib/catastro-host/captacion-filas";
import { kpisCaptacion, kpisPorComercial } from "@/lib/captacion/kpis";
import { explorerStoreDesdeSesion, respuestaSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { user, role, store, supabase } = await explorerStoreDesdeSesion();
  const sinSesion = respuestaSesion(user);
  if (sinSesion) return sinSesion;
  if (!user || !isAdmin(role)) {
    return Response.json({ ok: false, error: "Solo dirección ve el equipo." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("catastro_explorer_assignments")
    .select(
      "finca_reference, comercial_id, assigned_at, profiles:comercial_id(nombre_completo, email), catastro_explorer_pipeline(estado, proxima_accion, proxima_accion_en)"
    )
    .order("assigned_at", { ascending: false });
  if (error) {
    return Response.json({ ok: false, error: "No se han podido leer las asignaciones." }, { status: 500 });
  }

  const refs = (data ?? []).map((row) => String(row.finca_reference));
  const fincas = await store.getFincas(refs);
  const porRef = new Map(fincas.map((finca) => [finca.fincaReference, finca]));
  const { data: links } = refs.length
    ? await supabase.from("catastro_property_links").select("finca_reference, property_id").in("finca_reference", refs)
    : { data: [] as Array<{ finca_reference: string; property_id: string }> };
  const porLink = new Map((links ?? []).map((item) => [item.finca_reference, item.property_id]));

  const items = (data ?? [])
    .map((row) =>
      filaCaptacionDesdeAssignment(
        row as never,
        porRef.get(String(row.finca_reference)),
        porLink.get(String(row.finca_reference)) ?? null
      )
    )
    .filter((item): item is NonNullable<typeof item> => item != null);

  const { count: visitas } = await supabase
    .from("partes_visita")
    .select("id", { count: "exact", head: true });

  return Response.json({
    ok: true,
    items,
    kpis: kpisCaptacion({
      estados: items.map((item) => item.estado),
      conPropiedad: items.filter((item) => item.propertyId).length,
      visitas: visitas ?? 0,
    }),
    porComercial: kpisPorComercial(
      items.map((item) => ({
        comercialId: item.comercialId,
        nombre: item.comercialNombre,
        propertyId: item.propertyId,
      }))
    ),
  });
}
