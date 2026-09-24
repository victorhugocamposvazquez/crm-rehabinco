import type { AnuncioCaptacion } from "@/lib/captacion/portales/modelo";

export function esDescartado(a: Pick<AnuncioCaptacion, "fase">): boolean {
  return a.fase === "descartado";
}

export function esRetirado(a: Pick<AnuncioCaptacion, "desaparecido_en" | "fase">): boolean {
  return Boolean(a.desaparecido_en) && !esDescartado(a);
}

/** Activo en CRM: no descartado ni retirado del portal. */
export function esActivoCaptacion(a: Pick<AnuncioCaptacion, "desaparecido_en" | "fase">): boolean {
  return !esDescartado(a) && !a.desaparecido_en;
}

export function esAgencia(a: Pick<AnuncioCaptacion, "anunciante">): boolean {
  return a.anunciante !== "particular";
}
