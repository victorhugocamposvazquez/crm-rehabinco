import { tipoReferencia } from "./referencia";

export type MensajeReferencia = { ok: boolean; clase: "ok" | "err" | ""; texto: string };

/** Validación en vivo como en valorador.html (#l-ref). */
export function mensajeReferencia(raw: string): MensajeReferencia {
  const v = raw.toUpperCase().replace(/\s/g, "");
  if (!v) return { ok: false, clase: "", texto: "" };
  if (/[^0-9A-Z]/.test(v)) return { ok: false, clase: "err", texto: "Solo letras y números." };
  if (v.length < 14) return { ok: false, clase: "", texto: `Faltan ${14 - v.length} caracteres para la parcela.` };
  if (v.length === 14) return { ok: true, clase: "ok", texto: "Parcela: elegirás la vivienda en el siguiente paso." };
  if (v.length < 20) return { ok: false, clase: "", texto: `Faltan ${20 - v.length} caracteres para el inmueble.` };
  if (v.length === 20) {
    return tipoReferencia(v)
      ? { ok: true, clase: "ok", texto: "Inmueble: va directo a sus datos de Catastro." }
      : { ok: false, clase: "err", texto: "Formato no válido." };
  }
  return { ok: false, clase: "err", texto: "Sobran caracteres." };
}
