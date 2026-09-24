import { coordsFichaIdealista } from "@/lib/captacion/brightdata/geo-idealista";
import { fusionarFechaPortal } from "@/lib/captacion/brightdata/fecha-portal";
import { parsearFichaIdealista } from "@/lib/captacion/brightdata/parse-ficha";
import { createAdminClient } from "@/lib/supabase/admin";

const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000;

export function urlFicha(externoId: string): string {
  return `https://www.idealista.com/inmueble/${externoId}/`;
}

export function prioridadFicha(anunciante: string | null | undefined): number {
  return anunciante === "particular" ? 1 : 2;
}

export async function encolarFicha(externoId: string, anunciante: string | null | undefined): Promise<void> {
  if (!/^\d{5,}$/.test(externoId)) return;
  const supabase = createAdminClient();
  const url = urlFicha(externoId);
  const { data } = await supabase
    .from("captacion_paginas_pendientes")
    .select("id")
    .eq("url", url)
    .eq("tipo", "ficha")
    .eq("estado", "pendiente")
    .limit(1);
  if ((data ?? []).length > 0) return;
  const { error } = await supabase.from("captacion_paginas_pendientes").insert({
    recogida_id: null,
    url,
    zona_id: "ficha",
    page: 1,
    tipo: "ficha",
    prioridad: prioridadFicha(anunciante),
    estado: "pendiente",
    reintentar_en: null,
  });
  if (error) throw new Error(error.message);
}

export async function aplicarFicha(html: string, url: string): Promise<"ok" | "invalida"> {
  const ficha = parsearFichaIdealista(html, url);
  if (!ficha?.valida) {
    await marcarFichaPendiente(ficha?.externo_id ?? (url.match(/\/inmueble\/(\d+)/) || [])[1] ?? "");
    return "invalida";
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("captacion_anuncios")
    .select("id, publicado_en_portal, publicado_precision, contacto_nombre")
    .eq("portal_id", "idealista")
    .eq("externo_id", ficha.externo_id)
    .maybeSingle();
  if (!data?.id) return "invalida";
  const fecha = ficha.actualizado
    ? fusionarFechaPortal(
        {
          publicado_en_portal: (data.publicado_en_portal as string | null) ?? null,
          publicado_precision: (data.publicado_precision as string | null) ?? null,
        },
        { publicado_en_portal: ficha.actualizado, publicado_precision: "exacta" }
      )
    : null;
  const patch: Record<string, unknown> = {
    fotos: ficha.fotos,
    n_fotos: ficha.fotos.length,
    thumb: ficha.fotos[0] ?? null,
    enriquecido_ficha: true,
    ficha_pendiente: false,
    updated_at: new Date().toISOString(),
  };
  if (ficha.descripcion) patch.descripcion = ficha.descripcion;
  if (ficha.banos != null) patch.banos = ficha.banos;
  if (ficha.planta) patch.planta = ficha.planta;
  if (ficha.contact_name) patch.contacto_nombre = ficha.contact_name;
  if (fecha?.escrito) {
    patch.publicado_en_portal = fecha.publicado_en_portal;
    patch.publicado_precision = fecha.publicado_precision;
  }
  const geo = coordsFichaIdealista(html);
  if (geo) {
    patch.lat = geo.latitude;
    patch.lng = geo.longitude;
    patch.geo_aproximada = true;
  }
  const { error } = await supabase.from("captacion_anuncios").update(patch).eq("id", data.id);
  if (error) throw new Error(error.message);
  return "ok";
}

export async function marcarFichaPendiente(externoId: string): Promise<void> {
  if (!externoId) return;
  const supabase = createAdminClient();
  const reintentar = new Date(Date.now() + SIETE_DIAS).toISOString();
  await supabase
    .from("captacion_anuncios")
    .update({ ficha_pendiente: true, enriquecido_ficha: false })
    .eq("portal_id", "idealista")
    .eq("externo_id", externoId);
  await supabase
    .from("captacion_paginas_pendientes")
    .update({ estado: "pendiente", reintentar_en: reintentar })
    .eq("url", urlFicha(externoId))
    .eq("tipo", "ficha");
}

/** Activos sin ficha enriquecida. Particulares primero. Tope 300. No llama al Unlocker. */
export async function encolarFichasPendientes(tope = 300): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("captacion_anuncios")
    .select("externo_id, anunciante")
    .eq("portal_id", "idealista")
    .eq("enriquecido_ficha", false)
    .is("desaparecido_en", null)
    .in("fase", ["novedad", "contacto", "visita", "negociando"])
    .limit(tope * 2);
  const filas = ((data ?? []) as Array<{ externo_id?: string; anunciante?: string }>).filter((f) => f.externo_id);
  filas.sort((a, b) => prioridadFicha(a.anunciante) - prioridadFicha(b.anunciante));
  const elegidas = filas.slice(0, tope);
  for (const fila of elegidas) await encolarFicha(fila.externo_id as string, fila.anunciante);
  return elegidas.length;
}
