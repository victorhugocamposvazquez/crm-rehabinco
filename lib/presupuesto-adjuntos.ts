import type { AdjuntoPresupuesto } from "@/lib/presupuesto-propuesta";

const MAX_ADJUNTOS = 8;
const MAX_EDGE = 1400;

export function puedeAnadirAdjuntos(actual: number) {
  return actual < MAX_ADJUNTOS;
}

export async function fileToAdjunto(file: File): Promise<AdjuntoPresupuesto> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Solo se pueden adjuntar imágenes (JPG, PNG o WEBP).");
  }
  const dataUrl = await compressImage(file);
  return {
    id: crypto.randomUUID(),
    nombre: file.name.replace(/\.[^.]+$/, "") || "Adjunto",
    dataUrl,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File): Promise<string> {
  const raw = await readAsDataUrl(file);
  const img = await loadImage(raw);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar el adjunto.");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}
