import { claveContacto } from "@/lib/captacion/contacto";
import { publicadoEsCarga } from "@/lib/captacion/portales/modelo";
import { urlsDeFotosPortal } from "@/lib/inmuebles/media";
import type { AnuncioEntrante, FaseAnuncio } from "@/lib/captacion/portales/modelo";

export type AnuncioGuardado = {
  id: string;
  portal_id: string;
  externo_id: string;
  precio: number | null;
  precio_anterior?: number | null;
  tags: string[];
  fase: FaseAnuncio;
  alerta_id: string | null;
  desaparecido_en: string | null;
  hash_contenido?: string | null;
  raw_path?: string | null;
  parser_version?: string | null;
  titulo?: string | null;
  descripcion?: string | null;
  contacto_telefono?: string | null;
  contacto_nombre?: string | null;
  municipio?: string | null;
  publicado_en?: string | null;
  created_at?: string | null;
};

export type EventoSync =
  | { tipo: "nuevo"; externo_id: string; portal_id: string }
  | { tipo: "bajada"; externo_id: string; portal_id: string; de: number; a: number }
  | { tipo: "retirado"; id: string; externo_id: string; portal_id: string }
  | { tipo: "campo"; campo: string; anterior: string | null; nuevo: string | null };

export type PatchAnuncio = {
  clave: { portal_id: string; externo_id: string };
  row: Record<string, unknown>;
  eventos: EventoSync[];
  esNuevo: boolean;
  historial: Array<{ campo: string; valor_anterior: string | null; valor_nuevo: string | null }>;
};

const CAMPOS_HISTORIAL = [
  "precio",
  "titulo",
  "descripcion",
  "contacto_telefono",
  "contacto_nombre",
  "anunciante",
] as const;

function str(v: unknown): string | null {
  if (v == null) return null;
  return String(v);
}

export function hashContenidoAnuncio(entrante: AnuncioEntrante): string {
  const base = [
    entrante.titulo,
    entrante.descripcion ?? "",
    entrante.precio ?? "",
    entrante.superficie ?? "",
    entrante.habitaciones ?? "",
  ].join("|");
  let h = 0;
  for (let i = 0; i < base.length; i += 1) h = (Math.imul(31, h) + base.charCodeAt(i)) | 0;
  return `h${(h >>> 0).toString(16)}`;
}

/** Sustituye fusionarAnuncio: historial por campo y claves tel:/nom:. */
export function upsertAnuncio(
  previo: AnuncioGuardado | null,
  entrante: AnuncioEntrante,
  ahoraIso: string,
  alertaId: string | null,
  opts?: { rawPath?: string | null; parserVersion?: string | null }
): PatchAnuncio {
  const portalId = entrante.portal_id ?? entrante.fuente;
  // Si esta pasada no trajo el teléfono, no se borra el que ya teníamos.
  const telefono = entrante.contacto_telefono ?? previo?.contacto_telefono ?? null;
  const nombreContacto = entrante.contacto_nombre ?? previo?.contacto_nombre ?? null;
  const clave = claveContacto(telefono, nombreContacto, entrante.municipio);
  const tags = new Set(previo?.tags ?? []);
  if (entrante.tipo === "edificio") tags.add("Edificio");

  const eventos: EventoSync[] = [];
  const historial: PatchAnuncio["historial"] = [];
  const hashNuevo = hashContenidoAnuncio(entrante);

  let precioAnterior = previo?.precio_anterior ?? previo?.precio ?? null;
  if (previo?.precio != null && entrante.precio != null && entrante.precio < previo.precio) {
    tags.add("Bajada");
    precioAnterior = previo.precio;
    eventos.push({
      tipo: "bajada",
      externo_id: entrante.externo_id,
      portal_id: portalId,
      de: previo.precio,
      a: entrante.precio,
    });
    historial.push({
      campo: "precio",
      valor_anterior: String(previo.precio),
      valor_nuevo: String(entrante.precio),
    });
  }

  const esNuevo = !previo;
  if (esNuevo) {
    eventos.push({ tipo: "nuevo", externo_id: entrante.externo_id, portal_id: portalId });
  } else if (previo.hash_contenido && previo.hash_contenido !== hashNuevo) {
    for (const campo of CAMPOS_HISTORIAL) {
      const anterior = str((previo as Record<string, unknown>)[campo]);
      const nuevo = str((entrante as Record<string, unknown>)[campo]);
      if (anterior !== nuevo) {
        historial.push({ campo, valor_anterior: anterior, valor_nuevo: nuevo });
        eventos.push({ tipo: "campo", campo, anterior, nuevo });
      }
    }
  }

  return {
    clave: { portal_id: portalId, externo_id: entrante.externo_id },
    esNuevo,
    eventos,
    historial,
    row: {
      portal_id: portalId,
      fuente: portalId,
      externo_id: entrante.externo_id,
      url: entrante.url,
      titulo: entrante.titulo,
      descripcion: entrante.descripcion,
      operacion: entrante.operacion,
      tipo: entrante.tipo,
      anunciante: entrante.anunciante,
      precio: entrante.precio,
      precio_anterior: precioAnterior,
      superficie: entrante.superficie,
      habitaciones: entrante.habitaciones,
      banos: entrante.banos,
      planta: entrante.planta ?? null,
      direccion: entrante.direccion,
      zona: entrante.zona,
      municipio: entrante.municipio,
      codigo_postal: entrante.codigo_postal,
      lat: entrante.lat,
      lng: entrante.lng,
      geo_aproximada: entrante.geo_aproximada ?? false,
      thumb: entrante.thumb,
      n_fotos: entrante.n_fotos,
      fotos: urlsDeFotosPortal({ thumb: entrante.thumb, fotos: entrante.fotos, raw: entrante.raw }),
      contacto_nombre: nombreContacto,
      contacto_telefono: telefono,
      contacto_clave: clave,
      nombre_comercial: entrante.nombre_comercial ?? null,
      tags: [...tags],
      alerta_id: previo?.alerta_id ?? alertaId,
      visto_en: ahoraIso,
      desaparecido_en: null,
      hash_contenido: hashNuevo,
      raw_path: opts?.rawPath ?? previo?.raw_path ?? null,
      parser_version: opts?.parserVersion ?? previo?.parser_version ?? null,
      raw: entrante.raw,
      updated_at: ahoraIso,
      ...(esNuevo
        ? {
            fase: "novedad" as const,
            publicado_en: entrante.publicado_en ?? ahoraIso,
            visto_primera_vez: ahoraIso,
          }
        : entrante.publicado_en &&
            (!previo?.publicado_en || publicadoEsCarga(previo.publicado_en, previo.created_at))
          ? { publicado_en: entrante.publicado_en }
          : {}),
    },
  };
}

export function desaparecidosTrasSync(
  existentes: AnuncioGuardado[],
  vistos: Array<{ portal_id: string; externo_id: string }>,
  ahoraIso: string
): Array<{ id: string; evento: EventoSync }> {
  const vivos = new Set(vistos.map((v) => `${v.portal_id}:${v.externo_id}`));
  return existentes
    .filter((a) => !a.desaparecido_en && ["novedad", "contacto", "visita", "negociando"].includes(a.fase))
    .filter((a) => !vivos.has(`${a.portal_id}:${a.externo_id}`))
    .map((a) => ({
      id: a.id,
      evento: {
        tipo: "retirado" as const,
        id: a.id,
        externo_id: a.externo_id,
        portal_id: a.portal_id,
      },
    }));
}

export function filtrarParticular<T extends { anunciante: string }>(
  items: T[],
  soloParticulares: boolean
): T[] {
  if (!soloParticulares) return items;
  return items.filter((item) => item.anunciante === "particular");
}
