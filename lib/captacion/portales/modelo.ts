export const FUENTES_PORTAL = [
  "idealista",
  "habitaclia",
  "milanuncios",
  "fotocasa",
  "pisos.com",
  "wallapop",
] as const;
export type FuentePortal = (typeof FUENTES_PORTAL)[number];
export type PortalId = FuentePortal;

export const FASES_ANUNCIO = [
  "novedad",
  "contacto",
  "visita",
  "negociando",
  "captado",
  "perdido",
  "descartado",
] as const;
export type FaseAnuncio = (typeof FASES_ANUNCIO)[number];

export const FASES_KANBAN = ["contacto", "visita", "negociando", "captado", "perdido"] as const;
export type FaseKanban = (typeof FASES_KANBAN)[number];

export const ANUNCIANTES = ["particular", "empresa", "banco", "desconocido"] as const;
export type AnunciantePortal = (typeof ANUNCIANTES)[number];

export const TIPOS_ANUNCIO = ["piso", "casa", "edificio", "local", "terreno"] as const;
export type TipoAnuncioPortal = (typeof TIPOS_ANUNCIO)[number];

export const PORTAL_COLOR: Partial<Record<FuentePortal, string>> = {
  idealista: "#B5D334",
  habitaclia: "#E85D04",
  fotocasa: "#5B4FC9",
  milanuncios: "#E8642B",
  "pisos.com": "#0066CC",
  wallapop: "#13C1AC",
};

export const PORTAL_LABEL: Partial<Record<FuentePortal, string>> = {
  idealista: "Idealista",
  habitaclia: "Habitaclia",
  fotocasa: "Fotocasa",
  milanuncios: "Milanuncios",
  "pisos.com": "pisos.com",
  wallapop: "Wallapop",
};

export const TIPO_ANUNCIO_LABEL: Record<TipoAnuncioPortal, string> = {
  piso: "Piso",
  casa: "Casa",
  edificio: "Edificio",
  local: "Local",
  terreno: "Terreno",
};

export const FASE_KANBAN_META: Array<{
  id: FaseKanban;
  label: string;
  dot: string;
  hint: string;
  vacia: string;
}> = [
  { id: "contacto", label: "Contactar", dot: "#B98A16", hint: "primer toque", vacia: "Pasa aquí anuncios desde Novedades" },
  { id: "visita", label: "Visita", dot: "#3A6A82", hint: "", vacia: "Sin visitas pendientes" },
  { id: "negociando", label: "Negociando", dot: "#8579C4", hint: "honorarios · mandato", vacia: "Nada en negociación" },
  { id: "captado", label: "Captado", dot: "#0B7461", hint: "→ Inmuebles", vacia: "Aún nada captado" },
  { id: "perdido", label: "Perdido", dot: "#B3ADA3", hint: "últimos 30 días", vacia: "Ninguno perdido" },
];

export const TAG_ESTILO: Record<string, { bg: string; fg: string; label: string }> = {
  Herencia: { bg: "#FBF0D8", fg: "#7A5A10", label: "Herencia" },
  Urge: { bg: "#FBEAE5", fg: "#A33B2A", label: "Urge" },
  Reforma: { bg: "#E9EEF8", fg: "#2B4A8A", label: "Reforma" },
  Bajada: { bg: "#E8F3EF", fg: "#0B7461", label: "Bajada de precio" },
  Subida: { bg: "#FBF0D8", fg: "#7A5A10", label: "Subida de precio" },
  Edificio: { bg: "#F1EFF8", fg: "#4B3F8A", label: "Edificio" },
};

export const PAGE_NOVEDADES = 20;

/** Primera, última y las de alrededor. El hueco se marca con «…». */
export function paginasVisibles(actual: number, total: number): Array<number | "…"> {
  const n = Math.max(1, total);
  const pagina = Math.min(Math.max(1, actual), n);
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
  const marcas = [1, n, pagina - 1, pagina, pagina + 1].filter((x) => x >= 1 && x <= n);
  const unicas = [...new Set(marcas)].sort((a, b) => a - b);
  const salida: Array<number | "…"> = [];
  for (const num of unicas) {
    const previo = salida[salida.length - 1];
    if (typeof previo === "number" && num - previo > 1) salida.push("…");
    salida.push(num);
  }
  return salida;
}

export type AlertaCaptacion = {
  id: string;
  nombre: string;
  portales: FuentePortal[];
  zonas: string[];
  center_lat: number | null;
  center_lng: number | null;
  radio_m: number;
  operacion: "venta" | "alquiler";
  tipo: string | null;
  precio_max: number | null;
  m2_min: number | null;
  solo_particulares: boolean;
  frecuencia: "hora" | "6h" | "diaria";
  activa: boolean;
  comercial_id: string | null;
  created_by: string;
  last_sync_at: string | null;
};

export type AnuncioCaptacion = {
  id: string;
  fuente: FuentePortal;
  externo_id: string;
  url: string | null;
  titulo: string;
  descripcion: string | null;
  operacion: "venta" | "alquiler";
  tipo: string | null;
  anunciante: AnunciantePortal;
  precio: number | null;
  precio_anterior: number | null;
  superficie: number | null;
  habitaciones: number | null;
  banos: number | null;
  direccion: string | null;
  zona: string | null;
  municipio: string | null;
  codigo_postal: string | null;
  lat: number | null;
  lng: number | null;
  thumb: string | null;
  n_fotos: number | null;
  fotos?: string[];
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_clave: string | null;
  tags: string[];
  alerta_id: string | null;
  fase: FaseAnuncio;
  comercial_id: string | null;
  proxima_accion: string | null;
  propiedad_id: string | null;
  cliente_id: string | null;
  publicado_en: string | null;
  visto_en: string;
  visto_primera_vez: string | null;
  telefono_capturado_por: string | null;
  telefono_capturado_en: string | null;
  publicado_en_portal: string | null;
  publicado_precision: string | null;
  desaparecido_en: string | null;
  telefono_pendiente?: boolean;
  ficha_pendiente?: boolean;
  telefono_estado?: string | null;
  telefono_tipo?: string | null;
  telefono_reintentar_en?: string | null;
  contacto_telefono_fuente?: string | null;
  created_at: string;
};

export type AnuncioEntrante = {
  fuente: FuentePortal;
  portal_id?: FuentePortal;
  externo_id: string;
  url: string | null;
  titulo: string;
  descripcion: string | null;
  operacion: "venta" | "alquiler";
  tipo: string | null;
  anunciante: AnunciantePortal;
  precio: number | null;
  superficie: number | null;
  habitaciones: number | null;
  banos: number | null;
  planta?: string | null;
  geo_aproximada?: boolean;
  nombre_comercial?: string | null;
  direccion: string | null;
  zona: string | null;
  municipio: string | null;
  codigo_postal: string | null;
  lat: number | null;
  lng: number | null;
  thumb: string | null;
  n_fotos: number | null;
  fotos?: string[];
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  publicado_en: string | null;
  raw: Record<string, unknown>;
};

export function parseFuentePortal(value: unknown): FuentePortal | null {
  return FUENTES_PORTAL.includes(value as FuentePortal) ? (value as FuentePortal) : null;
}

/** Resuelve la fuente desde fila DB; prioriza portal_id (FK crawler) sobre fuente legacy. */
export function fuenteDesdeFila(row: { fuente?: unknown; portal_id?: unknown }): FuentePortal {
  const parsed = parseFuentePortal(row.portal_id) ?? parseFuentePortal(row.fuente);
  if (parsed) return parsed;
  const raw =
    (typeof row.portal_id === "string" && row.portal_id) ||
    (typeof row.fuente === "string" && row.fuente) ||
    "idealista";
  return raw as FuentePortal;
}

export function labelFuentePortal(fuente: string): string {
  const known = PORTAL_LABEL[fuente as FuentePortal];
  if (known) return known;
  if (fuente.includes(".")) return fuente;
  return fuente.charAt(0).toUpperCase() + fuente.slice(1);
}

export function parseFaseAnuncio(value: unknown): FaseAnuncio {
  return FASES_ANUNCIO.includes(value as FaseAnuncio) ? (value as FaseAnuncio) : "novedad";
}

export { claveContacto, claveContactoCanonica, telefonoE164 } from "@/lib/captacion/contacto";

export function euros(n: number | null | undefined, alquiler = false): string {
  if (n == null || Number.isNaN(n)) return "—";
  const txt = n.toLocaleString("es-ES") + " €";
  return alquiler ? `${txt}/mes` : txt;
}

export function eurosM2(precio: number | null | undefined, m2: number | null | undefined, alquiler = false): string {
  if (!precio || !m2 || m2 <= 0) return "—";
  const valor = alquiler ? Math.round((precio / m2) * 12) : Math.round(precio / m2);
  return euros(valor);
}

export function pctBajada(anterior: number | null | undefined, actual: number | null | undefined): string | null {
  if (!anterior || !actual || actual >= anterior) return null;
  const pct = Math.round(((anterior - actual) / anterior) * 100);
  if (pct < 1) return null;
  return `−${pct} % (${euros(anterior)})`;
}

/** La carga guarda `publicado_en` con la hora del CRM cuando Idealista no mandó fecha. */
export function publicadoEsCarga(
  publicado: string | null | undefined,
  creado: string | null | undefined
): boolean {
  if (!publicado || !creado) return false;
  const a = new Date(publicado).getTime();
  const b = new Date(creado).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(a - b) < 3 * 60 * 1000;
}

/** Fecha que mandó el portal. Null si `publicado_en` es solo la hora en que el CRM lo guardó. */
export function fechaPublicacionPortal(
  publicado: string | null | undefined,
  creado: string | null | undefined
): string | null {
  if (!publicado || publicadoEsCarga(publicado, creado)) return null;
  return publicado;
}

export function fotosAnuncio(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const urls: string[] = [];
  for (const item of valor) {
    if (typeof item === "string" && /^https?:\/\//i.test(item)) urls.push(item);
    else if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const url = rec.url ?? rec.src;
      if (typeof url === "string" && /^https?:\/\//i.test(url)) urls.push(url);
    }
  }
  return urls;
}

function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Idealista solo da el día; el CRM lo guarda a las 12:00 UTC para distinguirlo de una hora real. */
function soloDia(iso: string): boolean {
  return /T12:00:00(\.000)?Z$/.test(iso);
}

export function detectadoEl(iso: string | null | undefined): string {
  if (!iso) return "Detectado";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "Detectado";
  return `Detectado el ${fechaCorta(fecha)}`;
}

export function fechaCorta(fecha: Date): string {
  return `${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}/${fecha.getFullYear()}`;
}

/** «hace 30 minutos», «hace 10 horas», «Ayer» o 22/04/2026. */
export function cuandoPublicado(iso: string | null | undefined, ahora = new Date()): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  if (mismoDia(fecha, ayer)) return "Ayer";
  if (!mismoDia(fecha, ahora)) return fechaCorta(fecha);
  if (soloDia(iso)) return "Hoy";
  const minutos = Math.max(0, Math.round((ahora.getTime() - fecha.getTime()) / 60000));
  if (minutos < 1) return "ahora mismo";
  if (minutos < 60) return `hace ${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? "hora" : "horas"}`;
  return "Hoy";
}

export function diasEnPortal(iso: string | null | undefined, ahora = new Date()): number {
  if (!iso) return 0;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return 0;
  const a = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const b = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  return Math.max(0, Math.round((a.getTime() - b.getTime()) / 86400000));
}

export function publicadoHoy(
  publicado: string | null | undefined,
  creado: string | null | undefined,
  ahora = new Date()
): boolean {
  const portal = fechaPublicacionPortal(publicado, creado);
  return portal != null && diasEnPortal(portal, ahora) === 0;
}

/** Fecha de Idealista, o un aviso si el listado no la trajo. */
export function textoPublicado(
  a: {
    publicado_en: string | null;
    created_at: string | null;
    desaparecido_en?: string | null;
    visto_primera_vez?: string | null;
  },
  ahora = new Date()
): string {
  if (a.desaparecido_en) return `Retirado el ${fechaCorta(new Date(a.desaparecido_en))}`;
  const portal = fechaPublicacionPortal(a.publicado_en, a.created_at);
  if (portal) return cuandoPublicado(portal, ahora);
  return detectadoEl(a.visto_primera_vez || a.created_at);
}

export const AYUDA_DETECTADO = "fecha en que el CRM lo vio por primera vez";

export function tagsConEstilo(tags: string[]) {
  return tags
    .map((tag) => TAG_ESTILO[tag] ?? null)
    .filter((item): item is { bg: string; fg: string; label: string } => Boolean(item));
}
