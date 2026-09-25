import { claveContacto, esTelefonoVirtualIdealista, telefonoE164 } from "@/lib/captacion/contacto";
import { parsearTelefonoIdealista } from "@/lib/captacion/brightdata/parse-telefono";
import { registrarResultadoTelefono } from "@/lib/captacion/brightdata/telefonos-metricas";
import { aplicarScore } from "@/lib/captacion/pipeline/guardar";
import type { AnuncioEntrante } from "@/lib/captacion/portales/modelo";
import { createAdminClient } from "@/lib/supabase/admin";

const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000;
const TREINTA_DIAS = 30 * 24 * 60 * 60 * 1000;
export const PRIORIDAD_TELEFONO = 10;
export const MAX_INTENTOS_TELEFONO = 3;

export function urlTelefono(externoId: string): string {
  return `https://www.idealista.com/es/ajax/ads/${externoId}/contact-phones`;
}

export function externoIdDeUrlTelefono(url: string): string {
  return (url.match(/\/ads\/(\d+)\/contact-phones/) || [])[1] ?? "";
}

export async function encolarTelefono(
  externoId: string,
  opts?: { demanda?: boolean; anunciante?: string | null }
): Promise<void> {
  if (!/^\d{5,}$/.test(externoId)) return;
  const supabase = createAdminClient();
  const { data: anuncio } = await supabase
    .from("captacion_anuncios")
    .select("anunciante, contacto_telefono, telefono_capturado_en, telefono_tipo, telefono_estado, telefono_reintentar_en")
    .eq("portal_id", "idealista")
    .eq("externo_id", externoId)
    .maybeSingle();
  const anunciante = opts?.anunciante ?? (typeof anuncio?.anunciante === "string" ? anuncio.anunciante : null);
  if (!opts?.demanda && anunciante !== "particular") return;
  if (anuncio?.telefono_capturado_en) return;
  if (!opts?.demanda && anuncio?.contacto_telefono && anuncio.telefono_tipo !== "virtual_idealista") return;
  if (!opts?.demanda && anuncio?.telefono_estado === "solo_mensaje") {
    const re = anuncio.telefono_reintentar_en;
    if (re && new Date(re).getTime() > Date.now()) return;
  }
  const url = urlTelefono(externoId);
  const { data } = await supabase
    .from("captacion_paginas_pendientes")
    .select("id")
    .eq("url", url)
    .eq("tipo", "telefono")
    .eq("estado", "pendiente")
    .limit(1);
  if ((data ?? []).length > 0) return;
  await supabase
    .from("captacion_anuncios")
    .update({ telefono_estado: "pendiente", telefono_pendiente: false })
    .eq("portal_id", "idealista")
    .eq("externo_id", externoId);
  const { error } = await supabase.from("captacion_paginas_pendientes").insert({
    recogida_id: null,
    url,
    zona_id: "telefono",
    page: 1,
    tipo: "telefono",
    prioridad: PRIORIDAD_TELEFONO,
    estado: "pendiente",
    reintentar_en: null,
    intentos: 0,
  });
  if (error) throw new Error(error.message);
}

export async function aplicarSoloMensaje(externoId: string, paginaId: string): Promise<void> {
  if (!externoId) return;
  const supabase = createAdminClient();
  const reintentar = new Date(Date.now() + TREINTA_DIAS).toISOString();
  const ahora = new Date().toISOString();
  await supabase
    .from("captacion_anuncios")
    .update({
      telefono_estado: "solo_mensaje",
      telefono_reintentar_en: reintentar,
      telefono_pendiente: false,
      updated_at: ahora,
    })
    .eq("portal_id", "idealista")
    .eq("externo_id", externoId);
  await supabase.from("captacion_paginas_pendientes").update({ estado: "hecha" }).eq("id", paginaId);
  await registrarResultadoTelefono("solo_mensaje");
}

export async function aplicarTelefono(cuerpo: string, url: string): Promise<"ok" | "transporte" | "sin_numero"> {
  const externoId = externoIdDeUrlTelefono(url);
  const parsed = parsearTelefonoIdealista(cuerpo, externoId);
  if (!parsed.transporte_ok) {
    await registrarResultadoTelefono("fallo");
    return "transporte";
  }
  if (parsed.telefonos.length === 0) {
    await registrarResultadoTelefono("fallo");
    return "sin_numero";
  }
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("captacion_anuncios")
    .select("id, contacto_telefono, contacto_nombre, municipio, telefono_capturado_en")
    .eq("portal_id", "idealista")
    .eq("externo_id", externoId)
    .maybeSingle();
  if (!data?.id) {
    await registrarResultadoTelefono("fallo");
    return "sin_numero";
  }
  if (data.telefono_capturado_en) {
    await registrarResultadoTelefono("ok");
    return "ok";
  }
  const telefono = parsed.telefonos[0];
  const virtual = esTelefonoVirtualIdealista(telefono);
  const nombre = data.contacto_nombre == null ? null : String(data.contacto_nombre);
  const municipio = data.municipio == null ? null : String(data.municipio);
  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from("captacion_anuncios")
    .update({
      contacto_telefono: telefono,
      contacto_telefono_fuente: "unlocker",
      contacto_clave: virtual ? claveContacto(null, nombre, municipio) : claveContacto(telefono, nombre, municipio),
      telefono_tipo: virtual ? "virtual_idealista" : null,
      telefono_estado: virtual ? "virtual" : "real",
      telefono_pendiente: false,
      telefono_reintentar_en: null,
      updated_at: ahora,
    })
    .eq("id", data.id);
  if (error) throw new Error(error.message);
  if (!virtual) {
    const entrante = {
      fuente: "idealista",
      portal_id: "idealista",
      externo_id: externoId,
      contacto_telefono: telefono,
      contacto_nombre: nombre,
      municipio,
    } as AnuncioEntrante;
    await aplicarScore(supabase, String(data.id), entrante, ahora, []);
  }
  await registrarResultadoTelefono("ok");
  return "ok";
}

export async function guardarTelefonoManual(
  anuncioId: string,
  telefonoRaw: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("captacion_anuncios")
    .select("id, portal_id, externo_id, contacto_nombre, municipio, contacto_telefono, telefono_tipo")
    .eq("id", anuncioId)
    .maybeSingle();
  if (!data?.id) return { ok: false, error: "Anuncio no encontrado." };
  const telefono = telefonoE164(telefonoRaw);
  if (!telefono || esTelefonoVirtualIdealista(telefono)) {
    return { ok: false, error: "Teléfono no válido." };
  }
  const nombre = data.contacto_nombre == null ? null : String(data.contacto_nombre);
  const municipio = data.municipio == null ? null : String(data.municipio);
  const ahora = new Date().toISOString();
  const portal = String(data.portal_id ?? "idealista");
  await supabase
    .from("captacion_anuncios")
    .update({
      contacto_telefono: telefono,
      contacto_clave: claveContacto(telefono, nombre, municipio),
      contacto_telefono_fuente: "manual",
      telefono_tipo: null,
      telefono_estado: "real",
      telefono_pendiente: false,
      telefono_reintentar_en: null,
      telefono_capturado_por: userId,
      telefono_capturado_en: ahora,
      updated_at: ahora,
    })
    .eq("id", data.id);
  const entrante = {
    fuente: portal,
    portal_id: portal,
    externo_id: String(data.externo_id),
    contacto_telefono: telefono,
    contacto_nombre: nombre,
    municipio,
  } as AnuncioEntrante;
  await aplicarScore(supabase, String(data.id), entrante, ahora, []);
  return { ok: true };
}

export async function marcarTelefonoPendiente(externoId: string, paginaId: string, intentos: number): Promise<void> {
  if (!externoId) return;
  const supabase = createAdminClient();
  const reintentar = new Date(Date.now() + SIETE_DIAS).toISOString();
  const siguiente = intentos + 1;
  if (siguiente >= MAX_INTENTOS_TELEFONO) {
    await supabase
      .from("captacion_anuncios")
      .update({
        telefono_pendiente: true,
        telefono_estado: "fallo",
        telefono_reintentar_en: reintentar,
      })
      .eq("portal_id", "idealista")
      .eq("externo_id", externoId);
    await supabase
      .from("captacion_paginas_pendientes")
      .update({ estado: "pendiente", reintentar_en: reintentar, intentos: 0 })
      .eq("id", paginaId);
    return;
  }
  await supabase
    .from("captacion_paginas_pendientes")
    .update({ estado: "pendiente", intentos: siguiente, reintentar_en: null })
    .eq("id", paginaId);
}
