import { FORMATS, type FormatId } from "./config";
import type { Publication } from "./publicacion";

export function textoRevision(input: {
  autor: string;
  referencia: string;
  formato: string;
  id?: string;
}): { titulo: string; cuerpo: string; url: string } {
  const etiqueta = input.formato in FORMATS ? FORMATS[input.formato as FormatId].label : "Diseño";
  const autor = input.autor.trim() || "Marketing";
  const ref = input.referencia.trim() || "un inmueble";
  return {
    titulo: "Solicitud de revisión de diseño",
    cuerpo: `${autor} pide revisión del diseño de ${ref} (${etiqueta}).`,
    url: input.id ? `/estudio/revisiones/${input.id}` : "/estudio/revisiones",
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

export function etiquetaEstado(estado: string): string {
  if (estado === "aprobada") return "Aprobada";
  if (estado === "rectificar") return "A rectificar";
  if (estado === "vista") return "Vista";
  return "Pendiente";
}

export function textoDecision(input: {
  decision: "aprobada" | "rectificar";
  referencia: string;
  motivo: string;
  id: string;
  propiedadId: string;
}): { titulo: string; cuerpo: string; url: string } {
  const ref = input.referencia.trim() || "un inmueble";
  const motivo = input.motivo.trim();
  if (input.decision === "aprobada") {
    return {
      titulo: "Diseño aprobado",
      cuerpo: motivo ? `Hugo ha aprobado el diseño de ${ref}. ${motivo}` : `Hugo ha aprobado el diseño de ${ref}.`,
      url: `/estudio/revisiones/${input.id}`,
    };
  }
  return {
    titulo: "Hay que rectificar el diseño",
    cuerpo: `Hugo pide cambios en ${ref}. ${motivo}`,
    url: `/estudio?inmueble=${input.propiedadId}&revision=${input.id}`,
  };
}

export function nombreCorto(nombre: string | null | undefined, email: string | null | undefined): string {
  const limpio = nombre?.trim();
  if (limpio) return limpio.split(/\s+/)[0] ?? limpio;
  const local = email?.trim().split("@")[0];
  return local || "Marketing";
}
