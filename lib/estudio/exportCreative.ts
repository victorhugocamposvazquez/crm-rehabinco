'use client';
/**
 * Exporta una creatividad a PNG a tamaño real (1080×1080, 1080×1350, 1080×1920, 1200×628).
 * Requiere `npm i html-to-image`. Las fotos tienen que venir de un origen con CORS (bucket público de
 * Supabase Storage o una ruta propia que haga de proxy); si no, el lienzo queda «tainted» y falla.
 */
import { toBlob } from 'html-to-image';
import { FORMATS, type FormatId } from "./config";

/** `node` es el elemento raíz que pinta <Creative> (lleva `data-estudio-creative`). */
export async function exportCreativePng(node: HTMLElement, format: FormatId): Promise<Blob> {
  await document.fonts.ready;
  const blob = await toBlob(node, { pixelRatio: FORMATS[format].w / node.offsetWidth, cacheBust: true });
  if (!blob) throw new Error('No se pudo generar la imagen');
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** «RHB-2026-0014_galeria_post.png» */
export const creativeFilename = (ref: string, template: string, format: FormatId) => `${ref}_${template}_${format}.png`;

/** Todas las pantallas en orden. `nodes[i]` es la raíz de la pantalla i. */
export async function exportSlides(nodes: HTMLElement[], format: FormatId): Promise<Blob[]> {
  const out: Blob[] = [];
  for (const node of nodes) out.push(await exportCreativePng(node, format));
  return out;
}

/** «RHB-214_feed_01.png»: el número mantiene el orden del carrusel. */
export const slideFilename = (ref: string, format: FormatId, index: number) => `${ref}_${format}_${String(index + 1).padStart(2, "0")}.png`;
