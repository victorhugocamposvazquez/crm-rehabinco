import { PARSER_VERSION, mapearBrightDataIdealista } from "@/lib/captacion/brightdata/idealista";
import { upsertAnuncio, type AnuncioGuardado } from "@/lib/captacion/pipeline/upsert";
import { createAdminClient } from "@/lib/supabase/admin";

const SELECT_PREVIO =
  "id, portal_id, externo_id, precio, precio_anterior, tags, fase, alerta_id, desaparecido_en, hash_contenido, raw_path, parser_version, titulo, descripcion, contacto_telefono, contacto_nombre, municipio, anunciante";

export type ResultadoIngesta = {
  nuevos: number;
  actualizados: number;
  omitidos: number;
  errores: string[];
};

/** Guarda el JSON de Bright Data. La detección de encubiertas lee estos mismos anuncios en /captacion. */
export async function ingestarIdealistaBrightData(
  registros: Record<string, unknown>[],
  ahoraIso = new Date().toISOString()
): Promise<ResultadoIngesta> {
  const supabase = createAdminClient();
  const resultado: ResultadoIngesta = { nuevos: 0, actualizados: 0, omitidos: 0, errores: [] };

  for (const registro of registros) {
    const entrante = mapearBrightDataIdealista(registro);
    if (!entrante) {
      resultado.omitidos += 1;
      continue;
    }
    const { data: prev, error: selErr } = await supabase
      .from("captacion_anuncios")
      .select(SELECT_PREVIO)
      .eq("portal_id", "idealista")
      .eq("externo_id", entrante.externo_id)
      .maybeSingle();
    if (selErr) {
      resultado.errores.push(`${entrante.externo_id}: ${selErr.message}`);
      continue;
    }
    const patch = upsertAnuncio(prev as AnuncioGuardado | null, entrante, ahoraIso, null, {
      parserVersion: PARSER_VERSION,
    });
    if (patch.esNuevo) {
      const { data: inserted, error: insErr } = await supabase
        .from("captacion_anuncios")
        .insert(patch.row)
        .select("id")
        .single();
      if (insErr || !inserted) {
        resultado.errores.push(`${entrante.externo_id}: ${insErr?.message ?? "sin fila"}`);
        continue;
      }
      resultado.nuevos += 1;
      await guardarHistorial(supabase, inserted.id, patch.historial, resultado, entrante.externo_id);
    } else if (prev) {
      const { error: updErr } = await supabase.from("captacion_anuncios").update(patch.row).eq("id", prev.id);
      if (updErr) {
        resultado.errores.push(`${entrante.externo_id}: ${updErr.message}`);
        continue;
      }
      resultado.actualizados += 1;
      await guardarHistorial(supabase, prev.id, patch.historial, resultado, entrante.externo_id);
    }
  }

  return resultado;
}

async function guardarHistorial(
  supabase: ReturnType<typeof createAdminClient>,
  anuncioId: string,
  historial: Array<{ campo: string; valor_anterior: string | null; valor_nuevo: string | null }>,
  resultado: ResultadoIngesta,
  externoId: string
) {
  for (const h of historial) {
    const { error } = await supabase.from("captacion_anuncios_historial").insert({
      anuncio_id: anuncioId,
      campo: h.campo,
      valor_anterior: h.valor_anterior,
      valor_nuevo: h.valor_nuevo,
    });
    if (error) resultado.errores.push(`${externoId} historial: ${error.message}`);
  }
}
