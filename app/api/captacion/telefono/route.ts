import { claveContacto } from "@/lib/captacion/contacto";
import { usuarioPorTokenExtension } from "@/lib/captacion/extension-auth";
import { fusionarFechaPortal, parsearActualizadoIdealista } from "@/lib/captacion/brightdata/fecha-portal";
import { aplicarScore } from "@/lib/captacion/pipeline/guardar";
import { fusionarTelefono } from "@/lib/captacion/telefono";
import type { AnuncioEntrante } from "@/lib/captacion/portales/modelo";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const usuario = await usuarioPorTokenExtension(request);
  if (!usuario) return Response.json({ ok: false, error: "No autorizado." }, { status: 401, headers: CORS });

  let cuerpo: { externo_id?: unknown; portal_id?: unknown; telefono?: unknown; url?: unknown; actualizado?: unknown };
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return Response.json({ ok: false, error: "JSON no válido." }, { status: 400, headers: CORS });
  }
  const externoId = String(cuerpo.externo_id ?? "").replace(/\D/g, "");
  if (cuerpo.portal_id !== "idealista" || !/^\d{5,}$/.test(externoId)) {
    return Response.json({ ok: false, error: "Anuncio no válido." }, { status: 400, headers: CORS });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("captacion_anuncios")
    .select("id, contacto_telefono, contacto_nombre, municipio, url, publicado_en_portal, publicado_precision")
    .eq("portal_id", "idealista")
    .eq("externo_id", externoId)
    .maybeSingle();
  if (!data?.id) return Response.json({ ok: false, error: "El anuncio no está en el CRM." }, { status: 404, headers: CORS });

  const telefonoEntrante = typeof cuerpo.telefono === "string" ? cuerpo.telefono : null;
  const fusion = fusionarTelefono(data.contacto_telefono == null ? null : String(data.contacto_telefono), telefonoEntrante);
  const actualizado = typeof cuerpo.actualizado === "string" ? parsearActualizadoIdealista(cuerpo.actualizado) : null;
  const fecha = actualizado
    ? fusionarFechaPortal(
        {
          publicado_en_portal: data.publicado_en_portal == null ? null : String(data.publicado_en_portal),
          publicado_precision: data.publicado_precision == null ? null : String(data.publicado_precision),
        },
        { publicado_en_portal: actualizado, publicado_precision: "exacta" }
      )
    : null;
  if (!fusion.telefono && !fecha?.escrito) {
    return Response.json({ ok: false, error: telefonoEntrante || actualizado ? "Nada nuevo que guardar." : "Teléfono no válido." }, { status: 400, headers: CORS });
  }
  if (fusion.telefono && !fusion.escrito && !fecha?.escrito) {
    return Response.json({ ok: true, conservado: true, telefono: fusion.telefono }, { headers: CORS });
  }

  const ahora = new Date().toISOString();
  const municipio = data.municipio == null ? null : String(data.municipio);
  const nombre = data.contacto_nombre == null ? null : String(data.contacto_nombre);
  const url = typeof cuerpo.url === "string" && cuerpo.url.startsWith("https://www.idealista.com/") ? cuerpo.url : data.url;
  const { error } = await admin
    .from("captacion_anuncios")
    .update({
      ...(fusion.telefono && fusion.escrito
        ? {
            contacto_telefono: fusion.telefono,
            contacto_clave: claveContacto(fusion.telefono, nombre, municipio),
            telefono_tipo: null,
            telefono_estado: "real",
            telefono_pendiente: false,
            contacto_telefono_fuente: "extension",
            telefono_capturado_por: usuario.id,
            telefono_capturado_en: ahora,
          }
        : {}),
      ...(fecha?.escrito
        ? { publicado_en_portal: fecha.publicado_en_portal, publicado_precision: fecha.publicado_precision }
        : {}),
      url,
    })
    .eq("id", data.id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS });

  const entrante = {
    fuente: "idealista",
    portal_id: "idealista",
    externo_id: externoId,
    contacto_telefono: fusion.telefono,
    contacto_nombre: nombre,
    municipio,
  } as AnuncioEntrante;
  await aplicarScore(admin, String(data.id), entrante, ahora, []);
  return Response.json({ ok: true, conservado: false, telefono: fusion.telefono }, { headers: CORS });
}
