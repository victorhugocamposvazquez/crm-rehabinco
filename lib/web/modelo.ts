export const DISENOS_WEB = ["claro", "noche", "editorial"] as const;
export type DisenoWeb = (typeof DISENOS_WEB)[number];

export const TIPOS_BLOQUE = ["cabecera", "hero", "texto", "inmuebles", "galeria", "contacto", "pie"] as const;
export type TipoBloque = (typeof TIPOS_BLOQUE)[number];

export const ETIQUETA_BLOQUE: Record<TipoBloque, string> = {
  cabecera: "Cabecera",
  hero: "Portada",
  texto: "Texto",
  inmuebles: "Inmuebles",
  galeria: "Galería",
  contacto: "Contacto",
  pie: "Pie",
};

export const ETIQUETA_DISENO: Record<DisenoWeb, string> = {
  claro: "Claro",
  noche: "Noche",
  editorial: "Editorial",
};

export type FotoWeb = { url: string; alt: string; path?: string };

export type ContenidoBloque = {
  titulo: string;
  subtitulo: string;
  cuerpo: string;
  texto: string;
  imagen_url: string | null;
  imagen_path: string | null;
  imagenes: FotoWeb[];
};

export type BloqueWeb = {
  id: string;
  tipo: TipoBloque;
  orden: number;
  visible: boolean;
  contenido: ContenidoBloque;
};

export type MarcaWeb = {
  nombre: string;
  telefono: string | null;
  email: string | null;
  web: string | null;
  logo: string | null;
};

export type InmuebleWeb = {
  referencia: string;
  titulo: string;
  localidad: string;
  tipo_inmueble: string | null;
  tipo_operacion: string;
  precio_venta: number | null;
  precio_alquiler: number | null;
  superficie_m2: number | null;
  habitaciones: number | null;
  banos: number | null;
  descripcion: string;
  fotos: string[];
};

export type WebPublica = {
  sitio: { diseno: DisenoWeb; publicado: boolean; marca: MarcaWeb };
  bloques: BloqueWeb[];
  inmuebles: InmuebleWeb[];
};

export type EditorWebDatos = {
  diseno: DisenoWeb;
  publicado: boolean;
  dominio: string | null;
  marca: MarcaWeb;
  logoClaro: string | null;
  logoOscuro: string | null;
  bloques: BloqueWeb[];
  inmuebles: InmuebleWeb[];
};

export function logoMarca(diseno: DisenoWeb, claro: string | null, oscuro: string | null): string | null {
  const elegido = diseno === "noche" ? oscuro || claro : claro || oscuro;
  return elegido || null;
}

/** La web tal como está en el editor, aunque no esté publicada ni guardada. */
export function vistaPreviaDe(input: {
  diseno: DisenoWeb;
  marca: MarcaWeb;
  bloques: BloqueWeb[];
  borradores: Record<string, ContenidoBloque | undefined>;
  inmuebles: InmuebleWeb[];
}): WebPublica {
  return {
    sitio: { diseno: input.diseno, publicado: true, marca: input.marca },
    bloques: input.bloques.filter((bloque) => bloque.visible).map((bloque) => ({
      ...bloque,
      contenido: input.borradores[bloque.id] ?? bloque.contenido,
    })),
    inmuebles: input.inmuebles,
  };
}

export type TemaWeb = {
  fondo: string;
  tinta: string;
  suave: string;
  tarjeta: string;
  linea: string;
  acento: string;
  acentoTinta: string;
  titulo: string;
};

export const TEMAS_WEB: Record<DisenoWeb, TemaWeb> = {
  claro: {
    fondo: "#F6F4EF",
    tinta: "#1A1A1A",
    suave: "#5C584F",
    tarjeta: "#FFFFFF",
    linea: "#E4DFD4",
    acento: "#1F4D3A",
    acentoTinta: "#FFFFFF",
    titulo: "inherit",
  },
  noche: {
    fondo: "#121214",
    tinta: "#F4F1EA",
    suave: "#B7B1A6",
    tarjeta: "#1C1C1F",
    linea: "#2E2E33",
    acento: "#E7C27A",
    acentoTinta: "#1A1408",
    titulo: "inherit",
  },
  editorial: {
    fondo: "#F7F1E8",
    tinta: "#1C140C",
    suave: "#6E5A48",
    tarjeta: "#FFFCF7",
    linea: "#E6D8C8",
    acento: "#8C2F2F",
    acentoTinta: "#FFFFFF",
    titulo: "Georgia, 'Times New Roman', serif",
  },
};

const VACIO: ContenidoBloque = {
  titulo: "",
  subtitulo: "",
  cuerpo: "",
  texto: "",
  imagen_url: null,
  imagen_path: null,
  imagenes: [],
};

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function imagenesDe(valor: unknown): FotoWeb[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const url = texto((item as { url?: unknown }).url).trim();
    if (!url) return [];
    const path = texto((item as { path?: unknown }).path).trim();
    return [{ url, alt: texto((item as { alt?: unknown }).alt), ...(path ? { path } : {}) }];
  });
}

export function contenidoDe(raw: unknown): ContenidoBloque {
  const dato = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const imagen = texto(dato.imagen_url).trim();
  return {
    ...VACIO,
    titulo: texto(dato.titulo),
    subtitulo: texto(dato.subtitulo),
    cuerpo: texto(dato.cuerpo),
    texto: texto(dato.texto),
    imagen_url: imagen || null,
    imagen_path: texto(dato.imagen_path).trim() || null,
    imagenes: imagenesDe(dato.imagenes),
  };
}

export function esDiseno(valor: unknown): valor is DisenoWeb {
  return valor === "claro" || valor === "noche" || valor === "editorial";
}

export function esTipoBloque(valor: unknown): valor is TipoBloque {
  return (TIPOS_BLOQUE as readonly string[]).includes(String(valor));
}

function numero(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() && Number.isFinite(Number(valor))) return Number(valor);
  return null;
}

/** Misma regla que la función SQL web_publica y que faltasWeb. */
export function aptoParaWeb(p: {
  titulo?: string | null;
  localidad?: string | null;
  descripcion?: string | null;
  tipo_operacion?: string | null;
  precio_venta?: number | null;
  precio_alquiler?: number | null;
  estado?: string | null;
  referencia?: string | null;
}): boolean {
  if (!p.referencia?.trim()) return false;
  if (p.estado === "baja") return false;
  if (!p.titulo?.trim()) return false;
  if (!p.localidad?.trim()) return false;
  if (!p.descripcion?.trim()) return false;
  const venta = p.precio_venta ?? null;
  const alquiler = p.precio_alquiler ?? null;
  if (p.tipo_operacion === "alquiler") return alquiler != null && alquiler > 0;
  if (p.tipo_operacion === "ambos") return venta != null && venta > 0 && alquiler != null && alquiler > 0;
  return venta != null && venta > 0;
}

export function precioPublico(p: Pick<InmuebleWeb, "tipo_operacion" | "precio_venta" | "precio_alquiler">): string {
  const euros = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  if (p.tipo_operacion === "alquiler" && p.precio_alquiler) return `${euros(p.precio_alquiler)}/mes`;
  if (p.tipo_operacion === "ambos" && p.precio_venta && p.precio_alquiler) {
    return `${euros(p.precio_venta)} · ${euros(p.precio_alquiler)}/mes`;
  }
  if (p.precio_venta) return euros(p.precio_venta);
  return "";
}

function inmuebleDe(raw: unknown): InmuebleWeb | null {
  if (!raw || typeof raw !== "object") return null;
  const dato = raw as Record<string, unknown>;
  const referencia = texto(dato.referencia).trim();
  const titulo = texto(dato.titulo).trim();
  const localidad = texto(dato.localidad).trim();
  const descripcion = texto(dato.descripcion).trim();
  const fotos = Array.isArray(dato.fotos) ? dato.fotos.filter((f): f is string => typeof f === "string" && f.trim().length > 0) : [];
  const item: InmuebleWeb = {
    referencia,
    titulo,
    localidad,
    tipo_inmueble: texto(dato.tipo_inmueble).trim() || null,
    tipo_operacion: texto(dato.tipo_operacion) || "venta",
    precio_venta: numero(dato.precio_venta),
    precio_alquiler: numero(dato.precio_alquiler),
    superficie_m2: numero(dato.superficie_m2),
    habitaciones: numero(dato.habitaciones),
    banos: numero(dato.banos),
    descripcion,
    fotos,
  };
  return aptoParaWeb(item) ? item : null;
}

function bloqueDe(raw: unknown): BloqueWeb | null {
  if (!raw || typeof raw !== "object") return null;
  const dato = raw as Record<string, unknown>;
  if (!esTipoBloque(dato.tipo) || typeof dato.id !== "string") return null;
  return {
    id: dato.id,
    tipo: dato.tipo,
    orden: numero(dato.orden) ?? 0,
    visible: dato.visible !== false,
    contenido: contenidoDe(dato.contenido),
  };
}

export function webPublicaDe(raw: unknown): WebPublica | null {
  if (!raw || typeof raw !== "object") return null;
  const dato = raw as Record<string, unknown>;
  const sitio = dato.sitio;
  if (!sitio || typeof sitio !== "object") return null;
  const s = sitio as Record<string, unknown>;
  if (!esDiseno(s.diseno) || typeof s.publicado !== "boolean") return null;
  const marcaRaw = s.marca && typeof s.marca === "object" ? (s.marca as Record<string, unknown>) : {};
  const bloques = Array.isArray(dato.bloques) ? dato.bloques.flatMap((b) => {
    const bloque = bloqueDe(b);
    return bloque ? [bloque] : [];
  }) : [];
  const inmuebles = Array.isArray(dato.inmuebles) ? dato.inmuebles.flatMap((item) => {
    const inmueble = inmuebleDe(item);
    return inmueble ? [inmueble] : [];
  }) : [];
  return {
    sitio: {
      diseno: s.diseno,
      publicado: s.publicado,
      marca: {
        nombre: texto(marcaRaw.nombre).trim() || "Rehabinco",
        telefono: texto(marcaRaw.telefono).trim() || null,
        email: texto(marcaRaw.email).trim() || null,
        web: texto(marcaRaw.web).trim() || null,
        logo: texto(marcaRaw.logo).trim() || null,
      },
    },
    bloques: bloques.sort((a, b) => a.orden - b.orden),
    inmuebles,
  };
}
