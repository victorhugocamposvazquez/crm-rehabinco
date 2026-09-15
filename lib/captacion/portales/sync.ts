import { claveContacto, type AnuncioEntrante, type FaseAnuncio } from "./modelo";
import { urlsDeFotosPortal } from "@/lib/inmuebles/media";

export type AnuncioGuardado = {
  id: string;
  fuente: string;
  externo_id: string;
  precio: number | null;
  tags: string[];
  fase: FaseAnuncio;
  alerta_id: string | null;
  desaparecido_en: string | null;
};

export type EventoSync =
  | { tipo: "nuevo"; externo_id: string; fuente: string }
  | { tipo: "bajada"; externo_id: string; fuente: string; de: number; a: number }
  | { tipo: "retirado"; id: string; externo_id: string; fuente: string };

export type PatchAnuncio = {
  clave: { fuente: string; externo_id: string };
  row: Record<string, unknown>;
  eventos: EventoSync[];
  esNuevo: boolean;
};

export function fusionarAnuncio(
  previo: AnuncioGuardado | null,
  entrante: AnuncioEntrante,
  ahoraIso: string,
  alertaId: string | null
): PatchAnuncio {
  const clave = claveContacto(entrante.contacto_telefono, entrante.contacto_nombre, entrante.municipio);
  const tags = new Set(previo?.tags ?? []);
  if (entrante.tipo === "edificio") tags.add("Edificio");
  const eventos: EventoSync[] = [];
  let precioAnterior = previo ? (previo as AnuncioGuardado & { precio_anterior?: number | null }).precio : null;
  if (previo?.precio != null && entrante.precio != null && entrante.precio < previo.precio) {
    tags.add("Bajada");
    precioAnterior = previo.precio;
    eventos.push({
      tipo: "bajada",
      externo_id: entrante.externo_id,
      fuente: entrante.fuente,
      de: previo.precio,
      a: entrante.precio,
    });
  }
  const esNuevo = !previo;
  if (esNuevo) {
    eventos.push({ tipo: "nuevo", externo_id: entrante.externo_id, fuente: entrante.fuente });
  }
  return {
    clave: { fuente: entrante.fuente, externo_id: entrante.externo_id },
    esNuevo,
    eventos,
    row: {
      fuente: entrante.fuente,
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
      direccion: entrante.direccion,
      zona: entrante.zona,
      municipio: entrante.municipio,
      codigo_postal: entrante.codigo_postal,
      lat: entrante.lat,
      lng: entrante.lng,
      thumb: entrante.thumb,
      n_fotos: entrante.n_fotos,
      fotos: urlsDeFotosPortal({ thumb: entrante.thumb, fotos: entrante.fotos, raw: entrante.raw }),
      contacto_nombre: entrante.contacto_nombre,
      contacto_telefono: entrante.contacto_telefono,
      contacto_clave: clave,
      tags: [...tags],
      alerta_id: previo?.alerta_id ?? alertaId,
      visto_en: ahoraIso,
      desaparecido_en: null,
      raw: entrante.raw,
      updated_at: ahoraIso,
      ...(esNuevo
        ? {
            fase: "novedad" as const,
            publicado_en: entrante.publicado_en ?? ahoraIso,
          }
        : {}),
    },
  };
}

export function desaparecidosTrasSync(
  existentes: AnuncioGuardado[],
  vistos: Array<{ fuente: string; externo_id: string }>,
  ahoraIso: string
): Array<{ id: string; evento: EventoSync }> {
  const vivos = new Set(vistos.map((v) => `${v.fuente}:${v.externo_id}`));
  return existentes
    .filter((a) => !a.desaparecido_en && ["novedad", "contacto", "visita", "negociando"].includes(a.fase))
    .filter((a) => !vivos.has(`${a.fuente}:${a.externo_id}`))
    .map((a) => ({
      id: a.id,
      evento: { tipo: "retirado" as const, id: a.id, externo_id: a.externo_id, fuente: a.fuente },
    }));
}

export function filtrarParticular(items: AnuncioEntrante[], soloParticulares: boolean): AnuncioEntrante[] {
  if (!soloParticulares) return items;
  return items.filter((item) => item.anunciante === "particular");
}
