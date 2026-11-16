import { ROLES_EQUIPO } from "@/lib/auth/roles";
import type { InmuebleMedia } from "./catalogo";
import type { TipoMediaInmueble } from "./media";

export const SELECT_INMUEBLE_MEDIA = "id, propiedad_id, tipo, path, url, orden, portada, origen_id, retoque";

const ROLES = new Set<string>(ROLES_EQUIPO);

/** Quien puede subir y borrar en la carpeta del piso. Igual que is_equipo(). */
export function puedeGestionarArchivo(role: unknown): boolean {
  return typeof role === "string" && ROLES.has(role);
}

export function esFotoAnuncio(tipo: string | null | undefined): boolean {
  return !tipo || tipo === "foto";
}

export function fotosAnuncio(media: InmuebleMedia[]): InmuebleMedia[] {
  return media.filter((m) => m.tipo === "foto").sort((a, b) => a.orden - b.orden);
}

export function delCajon(media: InmuebleMedia[], tipo: TipoMediaInmueble): InmuebleMedia[] {
  return media.filter((m) => m.tipo === tipo).sort((a, b) => a.orden - b.orden);
}

export function comoMedia(row: {
  id: string;
  propiedad_id: string;
  tipo: InmuebleMedia["tipo"];
  path: string;
  url: string;
  orden: number;
  portada: boolean;
  origen_id?: string | null;
  retoque?: string | null;
}): InmuebleMedia {
  return {
    id: row.id,
    propiedad_id: row.propiedad_id,
    tipo: row.tipo,
    path: row.path,
    url: row.url,
    orden: row.orden,
    portada: row.portada,
    origen_id: row.origen_id ?? null,
    retoque: row.retoque ?? null,
  };
}
