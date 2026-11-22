import { createClient } from "../supabase/server";

export const COLUMNAS_NOTA =
  "id, user_id, propiedad_id, ref_catastral, idufir, finca_registral, registro, direccion, municipio, provincia, titular, motivo, motivo_texto, estado, proveedor, proveedor_ref, coste_cents, incidencia, pdf_path, documento_id, resumen, resumen_modelo, solicitada_en, recibida_en, created_at, updated_at";

export async function sesionNotas() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export function sinSesion(): Response {
  return Response.json({ ok: false, error: "Sesión expirada" }, { status: 401 });
}
