import { z } from "zod";

export const PortalIdSchema = z.enum([
  "habitaclia",
  "milanuncios",
  "fotocasa",
  "pisos.com",
  "wallapop",
]);
export type Portal = z.infer<typeof PortalIdSchema>;

export const AnuncioCrudoSchema = z.object({
  portal_id: PortalIdSchema,
  externo_id: z.string().min(1),
  url: z.string().url().optional(),
  titulo: z.string().optional(),
  descripcion: z.string().optional(),
  operacion: z.enum(["venta", "alquiler"]).optional(),
  tipo: z.string().optional(),
  precio: z.number().optional(),
  superficie: z.number().optional(),
  habitaciones: z.number().optional(),
  banos: z.number().optional(),
  planta: z.string().optional(),
  municipio: z.string().optional(),
  zona: z.string().optional(),
  direccion: z.string().optional(),
  codigo_postal: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  geo_aproximada: z.boolean().optional(),
  fotos: z.array(z.string()).optional(),
  n_fotos: z.number().optional(),
  contacto_nombre: z.string().optional(),
  contacto_telefono: z.string().optional(),
  anunciante: z.enum(["particular", "profesional", "desconocido"]).optional(),
  contacto_tipo_portal: z.enum(["particular", "profesional", "desconocido"]).optional(),
  nombre_comercial: z.string().optional(),
  publicado_en: z.string().optional(),
});

export type AnuncioCrudo = z.infer<typeof AnuncioCrudoSchema>;

export type ZonaContratada = {
  id: string;
  portal_id: Portal;
  municipio: string | null;
  provincia: string | null;
  operacion: "venta" | "alquiler";
  tipos_inmueble: string[];
  portal_params: Record<string, unknown>;
};

export type ListadoParseado = {
  items: AnuncioCrudo[];
  hayMasPaginas: boolean;
};

/** Cuándo encolar job de detalle tras un anuncio nuevo en listado. */
export type DetalleNecesario = "nunca" | "sin_telefono" | "siempre";

export function debeEncolarDetalle(
  detalleNecesario: DetalleNecesario,
  opts: { esNuevo: boolean; tieneBuildDetailUrl: boolean; contactoTelefono?: string | null }
): boolean {
  if (!opts.esNuevo || !opts.tieneBuildDetailUrl) return false;
  if (detalleNecesario === "nunca") return false;
  if (detalleNecesario === "siempre") return true;
  return !opts.contactoTelefono;
}

export type TransportRespaldo = "unblocker";

export interface PortalAdapter {
  id: Portal;
  parserVersion: string;
  transport: "http" | "browser";
  /** Respaldo si HTTP directo recibe challenge (requiere UNBLOCKER_URL). */
  transportRespaldo?: TransportRespaldo;
  filtroParticularNativo: boolean;
  detalleNecesario: DetalleNecesario;
  ritmo: { minMs: number; maxMs: number; concurrencia: number };
  buildListUrl(zona: ZonaContratada, pagina: number): string;
  parseList(input: { body: string; url: string }): ListadoParseado;
  buildDetailUrl?(item: AnuncioCrudo): string;
  parseDetail?(input: { body: string; url: string }): Partial<AnuncioCrudo>;
  detectarBloqueo(res: { status: number; body: string; headers: Record<string, string> }): boolean;
  /** Cabeceras extra para API/HTML (p. ej. Wallapop). */
  httpHeaders?: Record<string, string>;
  /** Referer por defecto en peticiones HTTP. */
  referer?: string;
}
