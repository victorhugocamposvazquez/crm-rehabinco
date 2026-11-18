import { FORMATS, type FormatId } from "./config";
import type { Publication } from "./publicacion";

export function textoRevision(input: {
  autor: string;
  referencia: string;
  formato: string;
}): { titulo: string; cuerpo: string; url: string } {
  const etiqueta = input.formato in FORMATS ? FORMATS[input.formato as FormatId].label : "Diseño";
  const autor = input.autor.trim() || "Marketing";
  const ref = input.referencia.trim() || "un inmueble";
  return {
    titulo: "Nueva publicación del Estudio",
    cuerpo: `${autor} pide revisión del diseño de ${ref} (${etiqueta}).`,
    url: "/estudio/revisiones",
  };
}

export function publicacionGuardada(value: unknown): Publication | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const pub = value as Publication;
  if (typeof pub.format !== "string" || !(pub.format in FORMATS)) return null;
  if (!Array.isArray(pub.slides) || pub.slides.length === 0 || pub.slides.length > 10) return null;
  const slidesOk = pub.slides.every(
    (slide) => slide && typeof slide === "object" && typeof slide.id === "string" && typeof slide.template === "string"
  );
  return slidesOk ? pub : null;
}

export function nombreCorto(nombre: string | null | undefined, email: string | null | undefined): string {
  const limpio = nombre?.trim();
  if (limpio) return limpio.split(/\s+/)[0] ?? limpio;
  const local = email?.trim().split("@")[0];
  return local || "Marketing";
}
