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
  referencia?: string | null;
};

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

export function escaparSvg(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function svgPublicacion(plantillaId: PlantillaPublicacionId, datos: DatosPublicacion, logoDataUri?: string | null): string {
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
  <rect x="0" y="${y}" width="${ancho}" height="${barra}" fill="url(#sombra)"/>
  <text x="${pad}" y="${precioY}" fill="#ffffff" font-size="${precioSize}" font-family="DejaVu Sans, sans-serif" font-weight="700">${escaparSvg(datos.precio)}</text>
  ${datos.localidad ? `<text x="${pad}" y="${localidadY}" fill="#ffffff" font-size="${localidadSize}" font-family="DejaVu Sans, sans-serif">${escaparSvg(datos.localidad)}</text>` : ""}
  ${datos.detalle ? `<text x="${pad}" y="${detalleY}" fill="#ffffff" font-size="${detalleSize}" font-family="DejaVu Sans, sans-serif">${escaparSvg(datos.detalle)}</text>` : ""}
  <text x="${ancho - pad}" y="${marcaY}" fill="#ffffff" font-size="18" font-family="DejaVu Sans, sans-serif" text-anchor="end">${escaparSvg(datos.referencia || datos.marca)}</text>
</svg>`;
}
