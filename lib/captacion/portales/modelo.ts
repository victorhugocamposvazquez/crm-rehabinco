export const FUENTES_PORTAL = ["idealista", "fotocasa", "milanuncios"] as const;
export type FuentePortal = (typeof FUENTES_PORTAL)[number];

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

export const PORTAL_COLOR: Record<FuentePortal, string> = {
  idealista: "#B5D334",
  fotocasa: "#5B4FC9",
  milanuncios: "#E8642B",
};

export const PORTAL_LABEL: Record<FuentePortal, string> = {
  idealista: "idealista",
  fotocasa: "Fotocasa",
  milanuncios: "Milanuncios",
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
  Edificio: { bg: "#F1EFF8", fg: "#4B3F8A", label: "Edificio" },
};

export const PAGE_NOVEDADES = 8;

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
  desaparecido_en: string | null;
  created_at: string;
};

export type AnuncioEntrante = {
  fuente: FuentePortal;
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
  direccion: string | null;
  zona: string | null;
  municipio: string | null;
  codigo_postal: string | null;
  lat: number | null;
  lng: number | null;
  thumb: string | null;
  n_fotos: number | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  publicado_en: string | null;
  raw: Record<string, unknown>;
};

export function parseFuentePortal(value: unknown): FuentePortal | null {
  return FUENTES_PORTAL.includes(value as FuentePortal) ? (value as FuentePortal) : null;
}

export function parseFaseAnuncio(value: unknown): FaseAnuncio {
  return FASES_ANUNCIO.includes(value as FaseAnuncio) ? (value as FaseAnuncio) : "novedad";
}

export function claveContacto(
  telefono?: string | null,
  nombre?: string | null,
  municipio?: string | null
): string | null {
  const digits = (telefono ?? "").replace(/\D/g, "");
  if (digits.length >= 9) return `t:${digits}`;
  const n = (nombre ?? "").trim().toLowerCase();
  const m = (municipio ?? "").trim().toLowerCase();
  if (n.length >= 2 && m) return `n:${n}|${m}`;
  return null;
}

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

export function cuandoPublicado(iso: string | null | undefined, ahora = new Date()): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  const dia = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
  const ayerDate = new Date(ahora);
  ayerDate.setDate(ayerDate.getDate() - 1);
  const ayer = `${ayerDate.getFullYear()}-${String(ayerDate.getMonth() + 1).padStart(2, "0")}-${String(ayerDate.getDate()).padStart(2, "0")}`;
  const hora = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (dia === hoy) return `Hoy ${hora}`;
  if (dia === ayer) return "Ayer";
  const diff = Math.round((new Date(`${hoy}T12:00:00`).getTime() - new Date(`${dia}T12:00:00`).getTime()) / 86400000);
  if (diff > 1 && diff < 8) return `Hace ${diff} días`;
  return fecha.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function diasEnPortal(iso: string | null | undefined, ahora = new Date()): number {
  if (!iso) return 0;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return 0;
  const a = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const b = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  return Math.max(0, Math.round((a.getTime() - b.getTime()) / 86400000));
}

export function tagsConEstilo(tags: string[]) {
  return tags
    .map((tag) => TAG_ESTILO[tag] ?? null)
    .filter((item): item is { bg: string; fg: string; label: string } => Boolean(item));
}
