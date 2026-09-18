import type { SupabaseClient } from "@supabase/supabase-js";

const MESES = 12;

/** Anonimiza contactos sin anuncio activo en 12 meses. */
export async function ejecutarRetencionContactos(supabase: SupabaseClient): Promise<number> {
  const limite = new Date();
  limite.setMonth(limite.getMonth() - MESES);
  const limiteIso = limite.toISOString();

  const { data: contactos } = await supabase
    .from("captacion_contactos")
    .select("id, clave")
    .eq("anuncios_activos", 0)
    .lt("updated_at", limiteIso);

  let n = 0;
  for (const c of contactos ?? []) {
    await supabase
      .from("captacion_contactos")
      .update({
        telefono_e164: null,
        nombre_norm: "[anonimizado]",
        updated_at: new Date().toISOString(),
      })
      .eq("id", c.id);

    await supabase
      .from("captacion_anuncios")
      .update({ contacto_nombre: null, contacto_telefono: null, contacto_clave: null })
      .eq("contacto_id", c.id);

    n += 1;
  }
  return n;
}
