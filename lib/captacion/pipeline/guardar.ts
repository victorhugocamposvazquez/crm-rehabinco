import { existiaAntesDePasada, fechaDeListadoDiario, filtroDeListado, fusionarFechaPortal } from "@/lib/captacion/brightdata/fecha-portal";
import { zonaIdDeListado } from "@/lib/captacion/brightdata/zonas";
import { calcularScore } from "@/lib/captacion/score";
import { PARSER_VERSION } from "@/lib/captacion/brightdata/idealista";
import { buscarInmuebleDuplicado } from "@/lib/captacion/pipeline/dedup";
import { upsertAnuncio, type AnuncioGuardado } from "@/lib/captacion/pipeline/upsert";
import type { AnuncioEntrante } from "@/lib/captacion/portales/modelo";
import { createAdminClient } from "@/lib/supabase/admin";

const SELECT_PREVIO =
  "id, portal_id, externo_id, precio, precio_anterior, tags, fase, alerta_id, desaparecido_en, hash_contenido, raw_path, parser_version, titulo, descripcion, contacto_telefono, contacto_nombre, municipio, anunciante, publicado_en, publicado_en_portal, publicado_precision, visto_primera_vez, created_at";

type Admin = ReturnType<typeof createAdminClient>;

export type ResultadoGuardado = {
  nuevo: boolean;
  actualizado: boolean;
  anuncioId: string | null;
  errores: string[];
};

/** Mismo camino que el crawler: upsert, historial, contacto, dedup y score. */
export async function guardarAnuncioPipeline(
  supabase: Admin,
  entrante: AnuncioEntrante,
  ahoraIso: string,
  registro: Record<string, unknown>
): Promise<ResultadoGuardado> {
  const errores: string[] = [];
  const portalId = entrante.portal_id ?? entrante.fuente;
  const { data: prev, error: selErr } = await supabase
    .from("captacion_anuncios")
    .select(SELECT_PREVIO)
    .eq("portal_id", portalId)
    .eq("externo_id", entrante.externo_id)
    .maybeSingle();
  if (selErr) return { nuevo: false, actualizado: false, anuncioId: null, errores: [`${entrante.externo_id}: ${selErr.message}`] };

  const previo = prev as (AnuncioGuardado & {
    publicado_en_portal?: string | null;
    publicado_precision?: string | null;
    visto_primera_vez?: string | null;
  }) | null;
  const patch = upsertAnuncio(previo, entrante, ahoraIso, null, { parserVersion: PARSER_VERSION });
  const listingUrl = typeof registro.zona_url === "string" ? registro.zona_url : null;
  const filtro = filtroDeListado(listingUrl);
  const fechaListado = filtro
    ? fechaDeListadoDiario(filtro, new Date(ahoraIso), {
        venta: !/alquiler-/i.test(listingUrl ?? ""),
        existiaAntes: existiaAntesDePasada(
          previo?.visto_primera_vez ?? previo?.created_at ?? null,
          await pasadaCompletaAnterior(supabase)
        ),
      })
    : null;
  const fechaFusion = fechaListado
    ? fusionarFechaPortal(
        {
          publicado_en_portal: previo?.publicado_en_portal ?? null,
          publicado_precision: previo?.publicado_precision ?? null,
        },
        fechaListado
      )
    : null;
  if (fechaFusion?.escrito) {
    Object.assign(patch.row, {
      publicado_en_portal: fechaFusion.publicado_en_portal,
      publicado_precision: fechaFusion.publicado_precision,
    });
  }
  const zonaExplicita = typeof registro.zona_id === "string" ? registro.zona_id : null;
  const zonaVista = zonaExplicita ?? zonaIdDeListado(listingUrl);
  if (zonaVista) patch.row.zona_id = zonaVista;
  let anuncioId = previo?.id ?? null;
  let nuevo = false;
  let actualizado = false;
  if (patch.esNuevo) {
    const { data: inserted, error: insErr } = await supabase.from("captacion_anuncios").insert(patch.row).select("id").single();
    if (insErr || !inserted) {
      return { nuevo: false, actualizado: false, anuncioId: null, errores: [`${entrante.externo_id}: ${insErr?.message ?? "sin fila"}`] };
    }
    anuncioId = inserted.id;
    nuevo = true;
  } else if (previo) {
    const { error: updErr } = await supabase.from("captacion_anuncios").update(patch.row).eq("id", previo.id);
    if (updErr) return { nuevo: false, actualizado: false, anuncioId: previo.id, errores: [`${entrante.externo_id}: ${updErr.message}`] };
    actualizado = true;
  }

  if (anuncioId) {
    for (const h of patch.historial) {
      const { error } = await supabase.from("captacion_anuncios_historial").insert({
        anuncio_id: anuncioId,
        campo: h.campo,
        valor_anterior: h.valor_anterior,
        valor_nuevo: h.valor_nuevo,
      });
      if (error) errores.push(`${entrante.externo_id} historial: ${error.message}`);
    }
    await aplicarDedup(supabase, anuncioId, entrante, errores);
    await aplicarScore(supabase, anuncioId, entrante, ahoraIso, errores);
  }

  return { nuevo, actualizado, anuncioId, errores };
}

async function pasadaCompletaAnterior(supabase: Admin): Promise<string | null> {
  const { data } = await supabase
    .from("captacion_recogidas")
    .select("iniciada")
    .not("completada", "is", null)
    .eq("incompleta", false)
    .order("completada", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.iniciada == null ? null : String(data.iniciada);
}

async function aplicarDedup(supabase: Admin, anuncioId: string, entrante: AnuncioEntrante, errores: string[]) {
  if (!entrante.municipio) return;
  const { data, error } = await supabase
    .from("captacion_anuncios")
    .select("id, inmueble_id, operacion, tipo, municipio, superficie, habitaciones, lat, lng, contacto_telefono")
    .eq("municipio", entrante.municipio)
    .neq("id", anuncioId)
    .limit(40);
  if (error || !data?.length) return;
  const candidato = {
    id: anuncioId,
    operacion: entrante.operacion,
    tipo: entrante.tipo,
    municipio: entrante.municipio,
    superficie: entrante.superficie,
    habitaciones: entrante.habitaciones,
    lat: entrante.lat,
    lng: entrante.lng,
    geo_aproximada: false,
    contacto_telefono: entrante.contacto_telefono,
    phash_fotos: [] as string[],
  };
  const existentes = data.map((row) => ({
    id: String(row.id),
    operacion: String(row.operacion ?? ""),
    tipo: row.tipo == null ? null : String(row.tipo),
    municipio: row.municipio == null ? null : String(row.municipio),
    superficie: row.superficie == null ? null : Number(row.superficie),
    habitaciones: row.habitaciones == null ? null : Number(row.habitaciones),
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    geo_aproximada: false,
    contacto_telefono: row.contacto_telefono == null ? null : String(row.contacto_telefono),
    phash_fotos: [] as string[],
    inmueble_id: row.inmueble_id == null ? null : String(row.inmueble_id),
  }));
  const match = buscarInmuebleDuplicado(candidato, existentes);
  const inmueble = match ? existentes.find((row) => row.id === match.id)?.inmueble_id : null;
  if (!inmueble) return;
  const { error: updErr } = await supabase.from("captacion_anuncios").update({ inmueble_id: inmueble }).eq("id", anuncioId);
  if (updErr) errores.push(`${entrante.externo_id} dedup: ${updErr.message}`);
}

export async function aplicarScore(supabase: Admin, anuncioId: string, entrante: AnuncioEntrante, ahoraIso: string, errores: string[]) {
  const clave = (await supabase.from("captacion_anuncios").select("contacto_clave").eq("id", anuncioId).maybeSingle()).data?.contacto_clave;
  if (!clave || typeof clave !== "string") return;
  const { data, error } = await supabase
    .from("captacion_anuncios")
    .select("anunciante, nombre_comercial, contacto_nombre, contacto_telefono, operacion, tipo, municipio, portal_id, descripcion, publicado_en, desaparecido_en, created_at")
    .eq("contacto_clave", clave)
    .limit(50);
  if (error || !data?.length) return;
  const score = calcularScore({
    anuncios: data.map((row) => ({
      anunciante: String(row.anunciante ?? "desconocido"),
      nombre_comercial: row.nombre_comercial == null ? null : String(row.nombre_comercial),
      contacto_nombre: row.contacto_nombre == null ? null : String(row.contacto_nombre),
      contacto_telefono: row.contacto_telefono == null ? null : String(row.contacto_telefono),
      operacion: String(row.operacion ?? "venta"),
      tipo: row.tipo == null ? null : String(row.tipo),
      municipio: row.municipio == null ? null : String(row.municipio),
      portal_id: String(row.portal_id ?? entrante.fuente),
      descripcion: row.descripcion == null ? null : String(row.descripcion),
      publicado_en: row.publicado_en == null ? null : String(row.publicado_en),
      desaparecido_en: row.desaparecido_en == null ? null : String(row.desaparecido_en),
      created_at: row.created_at == null ? null : String(row.created_at),
    })),
    pesos: {},
  });
  const { data: contacto, error: upErr } = await supabase
    .from("captacion_contactos")
    .upsert(
      {
        clave,
        telefono_e164: entrante.contacto_telefono,
        municipio: entrante.municipio,
        anuncios_activos: data.filter((row) => !row.desaparecido_en).length,
        score_profesional: Math.max(0, Math.min(100, score.score)),
        senales: score.senales,
        nivel_aviso: score.nivel,
        updated_at: ahoraIso,
      },
      { onConflict: "clave" }
    )
    .select("id")
    .single();
  if (upErr || !contacto) {
    if (upErr) errores.push(`${entrante.externo_id} contacto: ${upErr.message}`);
    return;
  }
  const { error: linkErr } = await supabase.from("captacion_anuncios").update({ contacto_id: contacto.id }).eq("id", anuncioId);
  if (linkErr) errores.push(`${entrante.externo_id} contacto_id: ${linkErr.message}`);
}
