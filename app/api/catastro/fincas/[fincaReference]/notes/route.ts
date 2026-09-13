import { identidadFinca } from "@/lib/catastro/explorer";
import { explorerStoreDesdeSesion } from "@/lib/catastro-host/from-request";
import { notaDesdeFila, textoNotaFinca } from "@/lib/catastro-host/finca-notes";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fincaReference: string }> }
) {
  const { user } = await explorerStoreDesdeSesion();
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }

  const { fincaReference: bruto } = await context.params;
  const fincaReference = identidadFinca(bruto ?? "");
  if (!fincaReference) {
    return Response.json({ ok: false, error: "Finca no encontrada." }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catastro_explorer_notes")
    .select("notes, updated_at")
    .eq("finca_reference", fincaReference)
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, error: "No se han podido leer las notas." }, { status: 500 });
  }

  return Response.json({ ok: true, note: notaDesdeFila(fincaReference, data) });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ fincaReference: string }> }
) {
  const { user } = await explorerStoreDesdeSesion();
  if (!user) {
    return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
  }

  const { fincaReference: bruto } = await context.params;
  const fincaReference = identidadFinca(bruto ?? "");
  if (!fincaReference) {
    return Response.json({ ok: false, error: "Finca no encontrada." }, { status: 404 });
  }

  let cuerpo: { notes?: unknown } = {};
  try {
    cuerpo = (await request.json()) as { notes?: unknown };
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const notes = textoNotaFinca(cuerpo.notes);
  const updatedAt = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.from("catastro_explorer_notes").upsert(
    {
      finca_reference: fincaReference,
      notes,
      updated_by: user.id,
      updated_at: updatedAt,
    },
    { onConflict: "finca_reference" }
  );

  if (error) {
    return Response.json({ ok: false, error: "No se han podido guardar las notas." }, { status: 500 });
  }

  return Response.json({
    ok: true,
    note: { fincaReference, notes, updatedAt },
  });
}
