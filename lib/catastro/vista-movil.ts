/** Por debajo de este ancho se usa la versión móvil del prototipo (matchMedia). */
export const ANCHO_MOVIL_CATASTRO = 780;

export const MEDIA_MOVIL_CATASTRO = `(max-width: ${ANCHO_MOVIL_CATASTRO - 1}px)`;

export const CLASES_LISTA_BUSQUEDAS =
  "mt-3 flex flex-col gap-2.5 min-[780px]:mt-3 min-[780px]:gap-0 min-[780px]:overflow-hidden min-[780px]:rounded-2xl min-[780px]:border min-[780px]:border-[#E6E3DD] min-[780px]:bg-white";

export type AccionTecladoLista = "siguiente" | "anterior" | "cerrar" | "abrir" | null;

export function accionTecladoLista(key: string): AccionTecladoLista {
  if (key === "ArrowDown" || key === "j" || key === "J") return "siguiente";
  if (key === "ArrowUp" || key === "k" || key === "K") return "anterior";
  if (key === "Escape") return "cerrar";
  if (key === "Enter") return "abrir";
  return null;
}
