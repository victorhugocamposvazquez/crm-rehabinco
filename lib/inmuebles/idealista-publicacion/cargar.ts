import { createAdminClient } from "@/lib/supabase/admin";
import type { PropiedadFeed } from "../idealista-feed/build";

const ESTADOS_PUBLICABLES = ["disponible", "reservada"];

function urlAbsolutaFoto(url: string, siteUrl: string): string {
  const u = url.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const base = siteUrl.replace(/\/$/, "");
  if (u.startsWith("/")) return `${base}${u}`;
  return u;
}

type Fila = PropiedadFeed & {
  publicar_idealista?: boolean | null;
  estado?: string | null;
  idealista_anuncios?: unknown;
  inmueble_media?: Array<{ url: string; portada: boolean | null; tipo: string | null; orden: number | null }> | null;
};

export function filaAPropiedadFeed(row: Fila, siteUrl: string): PropiedadFeed {
  const media = [...(row.inmueble_media ?? [])]
    .filter((m) => m.tipo === "foto" || !m.tipo)
    .sort((a, b) => {
      const pa = a.portada ? 0 : 1;
      const pb = b.portada ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (a.orden ?? 0) - (b.orden ?? 0);
    });
  const fotos = media.map((m) => urlAbsolutaFoto(m.url, siteUrl)).filter(Boolean);
  const { inmueble_media: _media, publicar_idealista: _pub, estado: _estado, idealista_anuncios: _ids, ...rest } = row;
  return { ...rest, fotos };
}

const SELECT = `id, referencia, idealista_codigo, titulo, direccion, codigo_postal, localidad, tipo_operacion,
  precio_venta, precio_alquiler, superficie_m2, superficie_construida, superficie_parcela,
  habitaciones, banos, planta, descripcion, certificado_energetico, tipo_inmueble,
  idealista_tipo, idealista_visibilidad_direccion, ascensor, garaje, terraza, anio_construccion,
  tour_url, updated_at, publicar_idealista, estado, idealista_anuncios,
  inmueble_media(url, portada, tipo, orden)`;

export async function cargarCarteraIdealista(siteUrl: string): Promise<PropiedadFeed[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("propiedades")
    .select(SELECT)
    .eq("publicar_idealista", true)
    .in("estado", ESTADOS_PUBLICABLES);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Fila[]).map((row) => filaAPropiedadFeed(row, siteUrl));
}

export async function cargarPropiedadIdealista(
  propiedadId: string,
  siteUrl: string
): Promise<(PropiedadFeed & { publicar_idealista: boolean; anunciosGuardados: Record<string, string> }) | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("propiedades").select(SELECT).eq("id", propiedadId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Fila;
  return {
    ...filaAPropiedadFeed(row, siteUrl),
    publicar_idealista: Boolean(row.publicar_idealista),
    anunciosGuardados: idsGuardados(row.idealista_anuncios),
  };
}

export function idsGuardados(valor: unknown): Record<string, string> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const out: Record<string, string> = {};
  for (const [clave, id] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof id === "string" && id.trim()) out[clave] = id.trim();
    else if (typeof id === "number") out[clave] = String(id);
  }
  return out;
}

export function urlSitioPublico(explicita?: string): string {
  const vercel = process.env.VERCEL_URL?.trim();
  return (
    explicita?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (vercel ? (vercel.startsWith("http") ? vercel : `https://${vercel}`) : "") ||
    "https://www.rehabinco.com"
  );
}
