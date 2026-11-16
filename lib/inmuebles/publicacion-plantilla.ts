export const PLANTILLAS_PUBLICACION = [
  { id: "ig-cuadrado", etiqueta: "Instagram cuadrado", ancho: 1080, alto: 1080, archivo: "instagram-cuadrado" },
  { id: "ig-historia", etiqueta: "Historia de Instagram", ancho: 1080, alto: 1920, archivo: "instagram-historia" },
  { id: "fb-post", etiqueta: "Facebook", ancho: 1200, alto: 630, archivo: "facebook" },
] as const;

export type PlantillaPublicacionId = (typeof PLANTILLAS_PUBLICACION)[number]["id"];

export type FichaParaPublicacion = {
  titulo?: string | null;
  localidad?: string | null;
  tipo_operacion?: string | null;
  precio_venta?: number | null;
  precio_alquiler?: number | null;
  superficie_m2?: number | null;
  superficie_construida?: number | null;
  habitaciones?: number | null;
  banos?: number | null;
  referencia?: string | null;
};

export const CAMPOS_PUBLICACION = [
  { id: "precio", etiqueta: "Precio" },
  { id: "localidad", etiqueta: "Municipio" },
  { id: "metros", etiqueta: "Metros" },
  { id: "habitaciones", etiqueta: "Habitaciones" },
  { id: "banos", etiqueta: "Baños" },
  { id: "referencia", etiqueta: "Referencia" },
] as const;

export type CampoPublicacionId = (typeof CAMPOS_PUBLICACION)[number]["id"];
export type EstiloPublicacion = "barra" | "ficha";

export type PlantillaRedes = {
  formato: PlantillaPublicacionId;
  estilo: EstiloPublicacion;
  campos: CampoPublicacionId[];
};

const CAMPOS_VALIDOS = new Set<string>(CAMPOS_PUBLICACION.map((campo) => campo.id));

export function plantillaRedesPorDefecto(): PlantillaRedes {
  return { formato: "ig-cuadrado", estilo: "barra", campos: ["precio", "localidad", "metros", "habitaciones"] };
}

export function normalizarPlantillaRedes(valor: unknown): PlantillaRedes {
  const base = plantillaRedesPorDefecto();
  if (!valor || typeof valor !== "object") return base;
  const rec = valor as { formato?: unknown; estilo?: unknown; campos?: unknown };
  const formato = plantillaPublicacion(typeof rec.formato === "string" ? rec.formato : "")?.id ?? base.formato;
  const estilo: EstiloPublicacion = rec.estilo === "ficha" ? "ficha" : "barra";
  const campos = Array.isArray(rec.campos)
    ? rec.campos.filter((campo): campo is CampoPublicacionId => typeof campo === "string" && CAMPOS_VALIDOS.has(campo))
    : base.campos;
  return { formato, estilo, campos: campos.length ? campos : base.campos };
}

export type DatosPublicacion = {
  titulo: string;
  localidad: string;
  precio: string;
  detalle: string;
  referencia: string;
  marca: string;
};

export function plantillaPublicacion(id: string): (typeof PLANTILLAS_PUBLICACION)[number] | null {
  return PLANTILLAS_PUBLICACION.find((p) => p.id === id) ?? null;
}

function euros(valor: number): string {
  return valor
    .toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .replace(/[\u00a0\u202f]/g, " ");
}

function recortar(texto: string, max: number): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;
  return `${limpio.slice(0, max - 1).trimEnd()}…`;
}

export function datosPublicacion(ficha: FichaParaPublicacion, marca = "Rehabinco"): DatosPublicacion {
  const alquiler = ficha.tipo_operacion === "alquiler";
  const importe = alquiler ? ficha.precio_alquiler : ficha.precio_venta;
  const precio = importe && importe > 0 ? `${euros(importe)}${alquiler ? " / mes" : ""}` : "Consultar";
  const metros = ficha.superficie_m2 ?? ficha.superficie_construida;
  const partes = [
    metros && metros > 0 ? `${Math.round(metros)} m²` : "",
    ficha.habitaciones && ficha.habitaciones > 0 ? `${ficha.habitaciones} hab.` : "",
  ].filter(Boolean);
  return {
    titulo: recortar(ficha.titulo?.trim() || "Inmueble", 48),
    localidad: recortar(ficha.localidad?.trim() || "", 42),
    precio,
    detalle: partes.join(" · "),
    referencia: recortar(ficha.referencia?.trim() || "", 24),
    marca: recortar(marca.trim() || "Rehabinco", 28),
  };
}

export function piezasPublicacion(ficha: FichaParaPublicacion): Record<CampoPublicacionId, string> {
  const datos = datosPublicacion(ficha);
  const metros = ficha.superficie_m2 ?? ficha.superficie_construida;
  const banos = ficha.banos && ficha.banos > 0 ? `${ficha.banos} baños` : "";
  return {
    precio: datos.precio,
    localidad: datos.localidad,
    metros: metros && metros > 0 ? `${Math.round(metros)} m²` : "",
    habitaciones: ficha.habitaciones && ficha.habitaciones > 0 ? `${ficha.habitaciones} hab.` : "",
    banos,
    referencia: datos.referencia,
  };
}

export function datosVisibles(ficha: FichaParaPublicacion, plantilla: PlantillaRedes, marca = "Rehabinco"): DatosPublicacion {
  const piezas = piezasPublicacion(ficha);
  const extras = plantilla.campos
    .filter((campo) => campo !== "precio" && campo !== "localidad" && campo !== "referencia")
    .map((campo) => piezas[campo])
    .filter(Boolean);
  return {
    ...datosPublicacion(ficha, marca),
    precio: plantilla.campos.includes("precio") ? piezas.precio : "",
    localidad: plantilla.campos.includes("localidad") ? piezas.localidad : "",
    detalle: extras.join(" · "),
    referencia: plantilla.campos.includes("referencia") ? piezas.referencia : "",
  };
}

export function escaparSvg(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function svgPublicacion(
  plantillaId: PlantillaPublicacionId,
  datos: DatosPublicacion,
  logoDataUri?: string | null,
  estilo: EstiloPublicacion = "barra"
): string {
  const plantilla = plantillaPublicacion(plantillaId);
  if (!plantilla) return "";
  const { ancho, alto } = plantilla;
  const historia = plantillaId === "ig-historia";
  const facebook = plantillaId === "fb-post";
  const barra = historia ? 520 : facebook ? 188 : 300;
  const y = alto - barra;
  const precioSize = facebook ? 40 : historia ? 68 : 54;
  const localidadSize = facebook ? 22 : 28;
  const detalleSize = facebook ? 20 : 24;
  const pad = facebook ? 36 : 48;
  const precioY = y + (facebook ? 78 : historia ? 210 : 130);
  const localidadY = precioY + (facebook ? 36 : 52);
  const detalleY = localidadY + (facebook ? 32 : 42);
  const marcaY = alto - (facebook ? 22 : 36);
  const logo = logoDataUri
    ? `<image href="${escaparSvg(logoDataUri)}" xlink:href="${escaparSvg(logoDataUri)}" x="${pad}" y="36" width="${facebook ? 140 : 180}" height="64" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="${pad}" y="78" fill="#111111" font-size="28" font-family="DejaVu Sans, sans-serif" font-weight="700">${escaparSvg(datos.marca)}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="sombra" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.78"/>
    </linearGradient>
  </defs>
  <rect x="${pad - 12}" y="28" width="${facebook ? 168 : 210}" height="80" rx="16" fill="#ffffff" fill-opacity="0.92"/>
  ${logo}
  ${estilo === "ficha" ? fichaSvg(ancho, alto, pad, datos) : barraSvg({ ancho, y, barra, pad, precioY, localidadY, detalleY, marcaY, precioSize, localidadSize, detalleSize, datos })}
</svg>`;
}

function barraSvg(input: {
  ancho: number;
  y: number;
  barra: number;
  pad: number;
  precioY: number;
  localidadY: number;
  detalleY: number;
  marcaY: number;
  precioSize: number;
  localidadSize: number;
  detalleSize: number;
  datos: DatosPublicacion;
}): string {
  const { datos } = input;
  return `<rect x="0" y="${input.y}" width="${input.ancho}" height="${input.barra}" fill="url(#sombra)"/>
  ${datos.precio ? `<text x="${input.pad}" y="${input.precioY}" fill="#ffffff" font-size="${input.precioSize}" font-family="DejaVu Sans, sans-serif" font-weight="700">${escaparSvg(datos.precio)}</text>` : ""}
  ${datos.localidad ? `<text x="${input.pad}" y="${input.localidadY}" fill="#ffffff" font-size="${input.localidadSize}" font-family="DejaVu Sans, sans-serif">${escaparSvg(datos.localidad)}</text>` : ""}
  ${datos.detalle ? `<text x="${input.pad}" y="${input.detalleY}" fill="#ffffff" font-size="${input.detalleSize}" font-family="DejaVu Sans, sans-serif">${escaparSvg(datos.detalle)}</text>` : ""}
  <text x="${input.ancho - input.pad}" y="${input.marcaY}" fill="#ffffff" font-size="18" font-family="DejaVu Sans, sans-serif" text-anchor="end">${escaparSvg(datos.referencia || datos.marca)}</text>`;
}

function fichaSvg(ancho: number, alto: number, pad: number, datos: DatosPublicacion): string {
  const lineas = [datos.precio, datos.localidad, datos.detalle, datos.referencia].filter(Boolean);
  const altoCaja = 36 + lineas.length * 42;
  const y = Math.max(24, alto - altoCaja - 36);
  const textos = lineas
    .map((linea, indice) => {
      const grande = indice === 0 && linea === datos.precio;
      return `<text x="${pad + 28}" y="${y + 48 + indice * 42}" fill="#111111" font-size="${grande ? 36 : 24}" font-family="DejaVu Sans, sans-serif" font-weight="${grande ? 700 : 500}">${escaparSvg(linea)}</text>`;
    })
    .join("\n  ");
  return `<rect x="${pad}" y="${y}" width="${Math.min(560, ancho - pad * 2)}" height="${altoCaja}" rx="22" fill="#ffffff" fill-opacity="0.94"/>
  ${textos}`;
}
