/**
 * Diseño de la interfaz. "clasico" es el CRM de siempre (menú lateral);
 * "aire" es el diseño nuevo: barra superior fina, lanzador de módulos,
 * fondo gris muy claro, Inter, tarjetas con sombra suave y más espacio.
 * Se guarda por navegador y se aplica con `data-diseno` en <html>.
 */
export type Diseno = "clasico" | "aire";

export const CLAVE_DISENO = "crm-diseno";
export const EVENTO_DISENO = "crm-diseno-cambio";

/** Script inline del <head>: aplica el diseño antes de pintar para que no parpadee. */
export const SCRIPT_DISENO = `(function(){try{if(localStorage.getItem("${CLAVE_DISENO}")==="aire")document.documentElement.dataset.diseno="aire"}catch(e){}})();`;

export function parseDiseno(valor: unknown): Diseno {
  return valor === "aire" ? "aire" : "clasico";
}
