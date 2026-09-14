import { puedeCrearPropiedad } from "@/lib/auth/roles";
import { fincaUiDesdeRecord } from "@/lib/catastro/explorer/history-ui";
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

  const { data, error } = await supabase
    .from("catastro_explorer_assignments")
    .select("finca_reference")
    .eq("comercial_id", user.id)
    .order("assigned_at", { ascending: false });
  if (error) {
    return Response.json({ ok: false, error: "No se han podido leer tus fincas." }, { status: 500 });
  }

  const refs = (data ?? []).map((row) => String(row.finca_reference));
  const fincas = await store.getFincas(refs);
  const porRef = new Map(fincas.map((finca) => [finca.fincaReference, finca]));

  return Response.json({
    ok: true,
    fincas: refs
      .map((ref) => porRef.get(ref))
      .filter((finca): finca is NonNullable<typeof finca> => finca != null)
      .map(fincaUiDesdeRecord),
  });
}
