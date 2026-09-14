import { isAdmin, puedeCrearPropiedad } from "@/lib/auth/roles";
import { filaCaptacionDesdeAssignment } from "@/lib/catastro-host/captacion-filas";
import { explorerStoreDesdeSesion, respuestaSesion } from "@/lib/catastro-host/from-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { user, role, store, supabase } = await explorerStoreDesdeSesion();
  const sinSesion = respuestaSesion(user);
  if (sinSesion) return sinSesion;
  if (!user || !puedeCrearPropiedad(role)) {
    return Response.json({ ok: false, error: "No tienes permiso." }, { status: 403 });
  }

  let query = supabase
    .from("catastro_explorer_assignments")
    .select(
      "finca_reference, comercial_id, assigned_at, profiles:comercial_id(nombre_completo, email), catastro_explorer_pipeline(estado, proxima_accion, proxima_accion_en)"
    )
    .order("assigned_at", { ascending: false });
  if (!isAdmin(role)) query = query.eq("comercial_id", user.id);

  const { data, error } = await query;
  if (error) {
    return Response.json({ ok: false, error: "No se han podido leer tus fincas." }, { status: 500 });
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

  return Response.json({
    ok: true,
    fincas: items.map((item) => item.finca),
    items,
  });
}
