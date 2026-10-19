import { esArchivoFoto } from "./media";
import { esIpadOIphone } from "./selector-archivos";

const LADO_MAX = 2400;
const CALIDAD = 0.82;

/** Baja las fotos del móvil a un JPEG que el CRM y la web pueden guardar y mostrar. */
export async function prepararFotoParaSubida(file: File): Promise<File> {
  if (typeof document === "undefined" || !esArchivoFoto(file)) return file;
  if (file.type === "image/jpeg" && file.size <= 1_500_000) return file;
  // En iPad, decodificar varias fotos grandes tira Safari. Se suben tal cual.
  if (esIpadOIphone()) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height, 1));
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", CALIDAD));
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export async function prepararFotosParaSubida(files: File[]): Promise<File[]> {
  const salida: File[] = [];
  for (const file of files) salida.push(await prepararFotoParaSubida(file));
  return salida;
}
