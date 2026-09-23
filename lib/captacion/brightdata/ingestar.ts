import { claveContacto } from "@/lib/captacion/contacto";
import { PARSER_VERSION, datosPortalDe, mapearBrightDataIdealista } from "@/lib/captacion/brightdata/idealista";
import { upsertAnuncio, type AnuncioGuardado } from "@/lib/captacion/pipeline/upsert";
import { publicadoEsCarga } from "@/lib/captacion/portales/modelo";
import { createAdminClient } from "@/lib/supabase/admin";

const SELECT_PREVIO =
  "id, portal_id, externo_id, precio, precio_anterior, tags, fase, alerta_id, desaparecido_en, hash_contenido, raw_path, parser_version, titulo, descripcion, contacto_telefono, contacto_nombre, municipio, anunciante, publicado_en, created_at";

export type ResultadoIngesta = {
  nuevos: number;
  actualizados: number;
  omitidos: number;
  conTelefono: number;
  conFecha: number;
  errores: string[];
};

function vacio(): ResultadoIngesta {
  return { nuevos: 0, actualizados: 0, omitidos: 0, conTelefono: 0, conFecha: 0, errores: [] };
}

/** Guarda el JSON de Bright Data. La detección de encubiertas lee estos mismos anuncios en /captacion. */
export async function ingestarIdealistaBrightData(
  registros: Record<string, unknown>[],
  ahoraIso = new Date().toISOString(),
  opts?: { paralelo?: number }
): Promise<ResultadoIngesta> {
  const supabase = createAdminClient();
  const resultado = vacio();
  const paralelo = Math.max(1, opts?.paralelo ?? 1);

  for (let i = 0; i < registros.length; i += paralelo) {
    const partes = await Promise.all(
      registros.slice(i, i + paralelo).map((registro) => guardarRegistro(supabase, registro, ahoraIso))
    );
    for (const parte of partes) {
      resultado.nuevos += parte.nuevos;
      resultado.actualizados += parte.actualizados;
      resultado.omitidos += parte.omitidos;
      resultado.conTelefono += parte.conTelefono;
      resultado.conFecha += parte.conFecha;
      resultado.errores.push(...parte.errores);
    }
  }

  return resultado;
}

async function guardarRegistro(
  supabase: ReturnType<typeof createAdminClient>,
  registro: Record<string, unknown>,
  ahoraIso: string
): Promise<ResultadoIngesta> {
  const resultado = vacio();
  const entrante = mapearBrightDataIdealista(registro);
  if (!entrante) {
    const suelto = await guardarSoloPortal(supabase, registro, resultado);
    if (!suelto) resultado.omitidos += 1;
    return resultado;
  }
  const { data: prev, error: selErr } = await supabase
    .from("captacion_anuncios")
    .select(SELECT_PREVIO)
    .eq("portal_id", "idealista")
    .eq("externo_id", entrante.externo_id)
    .maybeSingle();
  if (selErr) {
    resultado.errores.push(`${entrante.externo_id}: ${selErr.message}`);
    return resultado;
  }
  const previo = prev as AnuncioGuardado | null;
  if (entrante.contacto_telefono && !previo?.contacto_telefono) resultado.conTelefono += 1;
  if (entrante.publicado_en && (!previo?.publicado_en || publicadoEsCarga(previo.publicado_en, previo.created_at))) {
    resultado.conFecha += 1;
  }
  const patch = upsertAnuncio(previo, entrante, ahoraIso, null, {
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
      return resultado;
    }
    resultado.nuevos += 1;
    await guardarHistorial(supabase, inserted.id, patch.historial, resultado, entrante.externo_id);
  } else if (prev) {
    const { error: updErr } = await supabase.from("captacion_anuncios").update(patch.row).eq("id", prev.id);
    if (updErr) {
      resultado.errores.push(`${entrante.externo_id}: ${updErr.message}`);
      return resultado;
    }
    resultado.actualizados += 1;
    await guardarHistorial(supabase, prev.id, patch.historial, resultado, entrante.externo_id);
  }
  return resultado;
}

type FilaPortal = {
  id: string;
  contacto_telefono: string | null;
  contacto_nombre: string | null;
  municipio: string | null;
  publicado_en: string | null;
  created_at: string | null;
};

/** La ficha no pintó título ni precio, pero sí el teléfono o la fecha. Se escriben en el anuncio que ya existe. */
async function guardarSoloPortal(
  supabase: ReturnType<typeof createAdminClient>,
  registro: Record<string, unknown>,
  resultado: ResultadoIngesta
): Promise<boolean> {
  const datos = datosPortalDe(registro);
  if (!datos || (!datos.telefono && !datos.publicado_en)) return false;
  const { data: prev, error } = await supabase
    .from("captacion_anuncios")
    .select("id, contacto_telefono, contacto_nombre, municipio, publicado_en, created_at")
    .eq("portal_id", "idealista")
    .eq("externo_id", datos.externoId)
    .maybeSingle();
  if (error) {
    resultado.errores.push(`${datos.externoId}: ${error.message}`);
    return false;
  }
  if (!prev) return false;
  return escribirPortal(supabase, prev, datos, resultado);
}

async function escribirPortal(
  supabase: ReturnType<typeof createAdminClient>,
  prev: FilaPortal,
  datos: { telefono: string | null; publicado_en: string | null },
  resultado: ResultadoIngesta
): Promise<boolean> {
  const patch: { contacto_telefono?: string; contacto_clave?: string; publicado_en?: string } = {};
  if (datos.telefono && !prev.contacto_telefono) {
    patch.contacto_telefono = datos.telefono;
    const clave = claveContacto(datos.telefono, prev.contacto_nombre, prev.municipio);
    if (clave) patch.contacto_clave = clave;
    resultado.conTelefono += 1;
  }
  if (datos.publicado_en && (!prev.publicado_en || publicadoEsCarga(prev.publicado_en, prev.created_at))) {
    patch.publicado_en = datos.publicado_en;
    resultado.conFecha += 1;
  }
  if (!patch.contacto_telefono && !patch.publicado_en) return false;
  const { error } = await supabase.from("captacion_anuncios").update(patch).eq("id", prev.id);
  if (error) {
    resultado.errores.push(`${prev.id}: ${error.message}`);
    return false;
  }
  resultado.actualizados += 1;
  return true;
}

const LOTE_APLICAR = 40;

/** Recorre lo ya guardado y rellena teléfono y fecha si estaban en el JSON y no en la ficha. */
export async function aplicarDatosPortalGuardados(desde = 0): Promise<{
  revisadas: number;
  telefonos: number;
  fechas: number;
  siguiente: number;
  queda: number;
  errores: string[];
}> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("captacion_anuncios")
    .select("id, raw, contacto_telefono, contacto_nombre, municipio, publicado_en, created_at")
    .eq("portal_id", "idealista")
    .order("id", { ascending: true })
    .range(desde, desde + LOTE_APLICAR - 1);
  if (error) {
    return { revisadas: 0, telefonos: 0, fechas: 0, siguiente: desde, queda: 0, errores: [error.message] };
  }
  const filas = data ?? [];
  let telefonos = 0;
  let fechas = 0;
  const errores: string[] = [];
  for (const fila of filas) {
    const datos = datosPortalDe(fila.raw);
    if (!datos) continue;
    const resultado = vacio();
    await escribirPortal(supabase, fila, datos, resultado);
    telefonos += resultado.conTelefono;
    fechas += resultado.conFecha;
    errores.push(...resultado.errores);
  }
  return {
    revisadas: filas.length,
    telefonos,
    fechas,
    siguiente: desde + filas.length,
    queda: filas.length === LOTE_APLICAR ? 1 : 0,
    errores,
  };
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
