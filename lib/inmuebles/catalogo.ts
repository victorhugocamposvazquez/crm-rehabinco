export const TIPOS_INMUEBLE = [
  "piso",
  "atico",
  "bajo",
  "chalet",
  "adosado",
  "local",
  "oficina",
  "nave",
  "solar",
  "garaje",
  "trastero",
] as const;

export type TipoInmueble = (typeof TIPOS_INMUEBLE)[number];

export const TIPO_INMUEBLE_LABEL: Record<TipoInmueble, string> = {
  piso: "Piso",
  atico: "Ático",
  bajo: "Bajo",
  chalet: "Chalet",
  adosado: "Adosado",
  local: "Local",
  oficina: "Oficina",
  nave: "Nave",
  solar: "Solar",
  garaje: "Garaje",
  trastero: "Trastero",
};

export const TIPOS_OPERACION = ["venta", "alquiler", "ambos"] as const;
export type TipoOperacion = (typeof TIPOS_OPERACION)[number];

export const TIPO_OPERACION_LABEL: Record<TipoOperacion, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  ambos: "Venta y alquiler",
};

export const ESTADOS_INMUEBLE = ["disponible", "reservada", "vendida", "alquilada", "baja"] as const;
export type EstadoInmueble = (typeof ESTADOS_INMUEBLE)[number];

export const ESTADO_INMUEBLE_LABEL: Record<EstadoInmueble, string> = {
  disponible: "Disponible",
  reservada: "Reservada",
  vendida: "Vendida",
  alquilada: "Alquilada",
  baja: "Baja",
};

export function labelTipoInmueble(v: string | null | undefined) {
  if (!v) return "—";
  return TIPO_INMUEBLE_LABEL[v as TipoInmueble] ?? v;
}

export function labelTipoOperacion(v: string | null | undefined) {
  if (!v) return "—";
  return TIPO_OPERACION_LABEL[v as TipoOperacion] ?? v;
}

export function labelEstadoInmueble(v: string | null | undefined) {
  if (!v) return "—";
  return ESTADO_INMUEBLE_LABEL[v as EstadoInmueble] ?? v;
}

export function formatPrecioInmueble(p: number | null | undefined) {
  if (p == null) return "—";
  return p.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export type Inmueble = {
  id: string;
  user_id: string;
  ofertante_id: string | null;
  origen?: "MANUAL" | "CATASTRO_EXPLORER" | string | null;
  catastro_linked_at?: string | null;
  titulo: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  localidad: string | null;
  tipo_operacion: TipoOperacion | string;
  precio_venta: number | null;
  precio_alquiler: number | null;
  superficie_m2: number | null;
  habitaciones: number | null;
  estado: EstadoInmueble | string;
  notas: string | null;
  referencia: string | null;
  tipo_inmueble: TipoInmueble | string | null;
  tipologia: string | null;
  banos: number | null;
  aseos: number | null;
  planta: string | null;
  ascensor: boolean | null;
  anio_construccion: number | null;
  superficie_util: number | null;
  superficie_construida: number | null;
  superficie_parcela: number | null;
  referencia_catastral: string | null;
  descripcion: string | null;
  video_url: string | null;
  comercial_id: string | null;
  publicado: boolean;
  created_at?: string | null;
};

export type InmuebleMedia = {
  id: string;
  propiedad_id: string;
  tipo: "foto" | "video" | "plano";
  path: string;
  url: string;
  orden: number;
  portada: boolean;
};

export type InmuebleFormValues = {
  ofertante_id: string;
  titulo: string;
  direccion: string;
  codigo_postal: string;
  localidad: string;
  tipo_operacion: TipoOperacion;
  precio_venta: string;
  precio_alquiler: string;
  superficie_m2: string;
  habitaciones: string;
  estado: EstadoInmueble;
  notas: string;
  tipo_inmueble: string;
  tipologia: string;
  banos: string;
  aseos: string;
  planta: string;
  ascensor: boolean;
  anio_construccion: string;
  superficie_util: string;
  superficie_construida: string;
  superficie_parcela: string;
  referencia_catastral: string;
  descripcion: string;
  video_url: string;
  publicado: boolean;
};

export const INMUEBLE_FORM_VACIO: InmuebleFormValues = {
  ofertante_id: "",
  titulo: "",
  direccion: "",
  codigo_postal: "",
  localidad: "",
  tipo_operacion: "venta",
  precio_venta: "",
  precio_alquiler: "",
  superficie_m2: "",
  habitaciones: "",
  estado: "disponible",
  notas: "",
  tipo_inmueble: "piso",
  tipologia: "",
  banos: "",
  aseos: "",
  planta: "",
  ascensor: false,
  anio_construccion: "",
  superficie_util: "",
  superficie_construida: "",
  superficie_parcela: "",
  referencia_catastral: "",
  descripcion: "",
  video_url: "",
  publicado: false,
};

function numOrNull(v: string) {
  const n = Number(v);
  return v.trim() && Number.isFinite(n) ? n : null;
}

export function inmuebleDesdeForm(values: InmuebleFormValues) {
  return {
    ofertante_id: values.ofertante_id,
    titulo: values.titulo.trim() || null,
    direccion: values.direccion.trim() || null,
    codigo_postal: values.codigo_postal.trim() || null,
    localidad: values.localidad.trim() || null,
    tipo_operacion: values.tipo_operacion,
    precio_venta: numOrNull(values.precio_venta),
    precio_alquiler: numOrNull(values.precio_alquiler),
    superficie_m2: numOrNull(values.superficie_m2),
    habitaciones: numOrNull(values.habitaciones),
    estado: values.estado,
    notas: values.notas.trim() || null,
    tipo_inmueble: values.tipo_inmueble || null,
    tipologia: values.tipologia.trim() || null,
    banos: numOrNull(values.banos),
    aseos: numOrNull(values.aseos),
    planta: values.planta.trim() || null,
    ascensor: values.ascensor,
    anio_construccion: numOrNull(values.anio_construccion),
    superficie_util: numOrNull(values.superficie_util),
    superficie_construida: numOrNull(values.superficie_construida),
    superficie_parcela: numOrNull(values.superficie_parcela),
    referencia_catastral: values.referencia_catastral.trim() || null,
    descripcion: values.descripcion.trim() || null,
    video_url: values.video_url.trim() || null,
    publicado: values.publicado,
  };
}

export function formDesdeInmueble(p: Partial<Inmueble>, fallbackOfertante = ""): InmuebleFormValues {
  return {
    ...INMUEBLE_FORM_VACIO,
    ofertante_id: p.ofertante_id ?? fallbackOfertante,
    titulo: p.titulo ?? "",
    direccion: p.direccion ?? "",
    codigo_postal: p.codigo_postal ?? "",
    localidad: p.localidad ?? "",
    tipo_operacion: (p.tipo_operacion as TipoOperacion) || "venta",
    precio_venta: p.precio_venta != null ? String(p.precio_venta) : "",
    precio_alquiler: p.precio_alquiler != null ? String(p.precio_alquiler) : "",
    superficie_m2: p.superficie_m2 != null ? String(p.superficie_m2) : "",
    habitaciones: p.habitaciones != null ? String(p.habitaciones) : "",
    estado: (p.estado as EstadoInmueble) || "disponible",
    notas: p.notas ?? "",
    tipo_inmueble: p.tipo_inmueble ?? "piso",
    tipologia: p.tipologia ?? "",
    banos: p.banos != null ? String(p.banos) : "",
    aseos: p.aseos != null ? String(p.aseos) : "",
    planta: p.planta ?? "",
    ascensor: Boolean(p.ascensor),
    anio_construccion: p.anio_construccion != null ? String(p.anio_construccion) : "",
    superficie_util: p.superficie_util != null ? String(p.superficie_util) : "",
    superficie_construida: p.superficie_construida != null ? String(p.superficie_construida) : "",
    superficie_parcela: p.superficie_parcela != null ? String(p.superficie_parcela) : "",
    referencia_catastral: p.referencia_catastral ?? "",
    descripcion: p.descripcion ?? "",
    video_url: p.video_url ?? "",
    publicado: Boolean(p.publicado),
  };
}
