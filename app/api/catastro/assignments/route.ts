import { puedeCrearPropiedad } from "@/lib/auth/roles";
import { identidadFinca } from "@/lib/catastro/explorer";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";
import {
  asignacionDesdeFila,
  esRolAsignable,
  MAX_ASIGNACION_LOTE,
  nombreComercial,
  refsDesdeCuerpoAsignacion,
  uuidComercial,
  type ComercialAsignable,
} from "@/lib/catastro-host/finca-assignment";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function comercialesAsignables(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ComercialAsignable[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre_completo, email, role, activo")
    .in("role", ["comercial", "agente", "admin"])
    .order("nombre_completo");
  if (error) return [];
  return (data ?? [])
    .filter((item) => item.activo !== false && esRolAsignable(item.role))
    .map((item) => ({
      id: item.id,
      nombre: nombreComercial(item),
    }));
}

export async function GET(request: Request) {
  const { user, role } = await explorerStoreDesdeSesion();
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }
  if (!puedeCrearPropiedad(role)) {
    return Response.json({ ok: false, error: "No tienes permiso." }, { status: 403 });
  }

  const refs = new URL(request.url).searchParams.get("refs")?.split(",") ?? [];
  const fincas = [...new Set(refs.map((item) => identidadFinca(item.trim()) ?? "").filter(Boolean))];
  const supabase = await createClient();
  const comerciales = await comercialesAsignables(supabase);

  if (fincas.length === 0) {
    return Response.json({ ok: true, me: user.id, comerciales, assignments: [] });
  }

  const { data, error } = await supabase
    .from("catastro_explorer_assignments")
    .select("finca_reference, comercial_id")
    .in("finca_reference", fincas);
  if (error) {
    return Response.json({ ok: false, error: "No se han podido leer las asignaciones." }, { status: 500 });
  }

  const assignments = (data ?? [])
    .map((row) => asignacionDesdeFila(String(row.finca_reference), row, comerciales))
    .filter((item): item is NonNullable<typeof item> => item != null);

  return Response.json({ ok: true, me: user.id, comerciales, assignments });
}

export async function PUT(request: Request) {
  const { user, role, properties } = await explorerStoreDesdeSesion();
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }
  if (!puedeCrearPropiedad(role)) {
    return Response.json({ ok: false, error: "No tienes permiso." }, { status: 403 });
  }

  let cuerpo: { fincaReference?: unknown; fincaReferences?: unknown; comercialId?: unknown } = {};
  try {
    cuerpo = (await request.json()) as {
      fincaReference?: unknown;
      fincaReferences?: unknown;
      comercialId?: unknown;
    };
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const refs = [
    ...new Set(
      refsDesdeCuerpoAsignacion(cuerpo)
        .map((item) => identidadFinca(item) ?? "")
        .filter(Boolean)
    ),
  ];
  if (refs.length === 0) {
    return Response.json({ ok: false, error: "Finca no encontrada." }, { status: 404 });
  }
  if (refs.length > MAX_ASIGNACION_LOTE) {
    return Response.json(
      { ok: false, error: `Como máximo ${MAX_ASIGNACION_LOTE} fincas de una vez.` },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const comerciales = await comercialesAsignables(supabase);
  const comercialId =
    cuerpo.comercialId == null || cuerpo.comercialId === ""
      ? null
      : uuidComercial(cuerpo.comercialId);

  if (cuerpo.comercialId != null && cuerpo.comercialId !== "" && !comercialId) {
    return Response.json({ ok: false, error: "Comercial inválido." }, { status: 400 });
  }
  if (comercialId && !comerciales.some((item) => item.id === comercialId)) {
    return Response.json({ ok: false, error: "Ese usuario no es un comercial asignable." }, { status: 400 });
  }

  if (!comercialId) {
    const { error } = await supabase
      .from("catastro_explorer_assignments")
      .delete()
      .in("finca_reference", refs);
    if (error) {
      return Response.json({ ok: false, error: "No se ha podido quitar la asignación." }, { status: 500 });
    }
    for (const ref of refs) {
      await sincronizarComercialPropiedad(supabase, properties, ref, null);
    }
    const assignments = refs.map(() => null);
    return Response.json({ ok: true, assignment: null, assignments, comerciales });
  }

  const ahora = new Date().toISOString();
  const { error } = await supabase.from("catastro_explorer_assignments").upsert(
    refs.map((ref) => ({
      finca_reference: ref,
      comercial_id: comercialId,
      assigned_by: user.id,
      assigned_at: ahora,
    })),
    { onConflict: "finca_reference" }
  );
  if (error) {
    return Response.json({ ok: false, error: "No se ha podido asignar el comercial." }, { status: 500 });
  }

  for (const ref of refs) {
    await sincronizarComercialPropiedad(supabase, properties, ref, comercialId);
  }
  const assignments = refs.map((ref) =>
    asignacionDesdeFila(ref, { comercial_id: comercialId }, comerciales)
  );
  return Response.json({
    ok: true,
    assignment: assignments[0] ?? null,
    assignments,
    comerciales,
  });
}

async function sincronizarComercialPropiedad(
  supabase: Awaited<ReturnType<typeof createClient>>,
  properties: { findLinksByFincaReference: (ref: string) => Promise<Array<{ propertyId: string }>> },
  fincaReference: string,
  comercialId: string | null
) {
  const links = await properties.findLinksByFincaReference(fincaReference);
  const propertyId = links[0]?.propertyId;
  if (!propertyId) return;
  await supabase.from("propiedades").update({ comercial_id: comercialId }).eq("id", propertyId);
}
