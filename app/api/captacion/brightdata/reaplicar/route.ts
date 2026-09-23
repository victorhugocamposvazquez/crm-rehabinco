import { mapearBrightDataIdealista } from "@/lib/captacion/brightdata/idealista";
import { claveContacto } from "@/lib/captacion/contacto";
import { publicadoEsCarga } from "@/lib/captacion/portales/modelo";
import { sesionCaptacion } from "@/lib/captacion/portales/sesion";
import { urlsDeFotosPortal } from "@/lib/inmuebles/media";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOTE = 25;

/** Vuelve a leer el JSON ya guardado: teléfono, fotos y fecha de Idealista. No lanza otra recogida. */
export async function POST(request: Request) {
  const sesion = await sesionCaptacion();
  if (!sesion.ok) return Response.json({ ok: false, error: sesion.error }, { status: sesion.status });

  let desde = 0;
  try {
    const cuerpo = (await request.json()) as { desde?: unknown };
    desde = typeof cuerpo.desde === "number" && Number.isFinite(cuerpo.desde) ? Math.max(0, Math.floor(cuerpo.desde)) : 0;
  } catch {
    desde = 0;
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("captacion_anuncios")
    .select("id", { count: "exact", head: true })
    .eq("portal_id", "idealista");
  const { data, error } = await admin
    .from("captacion_anuncios")
    .select("id, raw, thumb, contacto_telefono, contacto_nombre, municipio, fotos, n_fotos, publicado_en, created_at")
    .eq("portal_id", "idealista")
    .order("id", { ascending: true })
    .range(desde, desde + LOTE - 1);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  let telefonos = 0;
  let fotos = 0;
  let fechas = 0;
  for (const fila of data ?? []) {
    const raw = fila.raw;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const anuncio = mapearBrightDataIdealista(raw as Record<string, unknown>);
    if (!anuncio) continue;
    const patch: Record<string, unknown> = {};
    const nuevas = urlsDeFotosPortal({ thumb: anuncio.thumb, fotos: anuncio.fotos, raw: anuncio.raw });
    const guardadas = Array.isArray(fila.fotos) ? fila.fotos.length : 0;
    if (nuevas.length > guardadas) {
      patch.fotos = nuevas;
      patch.n_fotos = nuevas.length;
      fotos += 1;
    }
    if (!fila.thumb && anuncio.thumb) patch.thumb = anuncio.thumb;
    if (!fila.contacto_telefono && anuncio.contacto_telefono) {
      patch.contacto_telefono = anuncio.contacto_telefono;
      patch.contacto_clave = claveContacto(anuncio.contacto_telefono, anuncio.contacto_nombre, anuncio.municipio);
      if (anuncio.contacto_nombre) patch.contacto_nombre = anuncio.contacto_nombre;
      telefonos += 1;
    }
    if (
      anuncio.publicado_en &&
      (!fila.publicado_en || publicadoEsCarga(fila.publicado_en, fila.created_at))
    ) {
      patch.publicado_en = anuncio.publicado_en;
      fechas += 1;
    }
    if (Object.keys(patch).length === 0) continue;
    const { error: updErr } = await admin.from("captacion_anuncios").update(patch).eq("id", fila.id);
    if (updErr) return Response.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  const siguiente = desde + (data?.length ?? 0);
  const total = count ?? siguiente;
  return Response.json({
    ok: true,
    telefonos,
    fotos,
    fechas,
    total,
    siguiente,
    queda: Math.max(0, total - siguiente),
  });
}
