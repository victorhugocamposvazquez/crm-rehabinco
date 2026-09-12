export type ClasificacionCatalogoLtp = "YES" | "NO" | "UNKNOWN";

export type OrigenLtp =
  | "api-wcf-observado"
  | "faq-formato-cat"
  | "xsd-sin-enum";

export type EntradaCatalogoLtp = {
  literal: string;
  origen: OrigenLtp;
  fuente: string;
  classification: ClasificacionCatalogoLtp;
};

/**
 * Catálogo de literales de tipo de finca (`ltp`).
 * YES/NO solo para valores observados en el servicio web libre.
 * El resto, documentados por Catastro pero no validados en WCF, quedan UNKNOWN.
 *
 * El XSD oficial define `ltp` como string libre (`stringnb`), sin enumerado:
 * https://www.catastro.hacienda.gob.es/ws/esquemas/consulta_dnp.xsd
 */
export const CATALOGO_LTP: readonly EntradaCatalogoLtp[] = [
  {
    literal: "Parcela construida sin división horizontal",
    origen: "api-wcf-observado",
    fuente: "Consulta_DNPLOC / Consulta_DNPRC (bico.finca.ltp)",
    classification: "NO",
  },
  {
    literal: "Parcela con varios inmuebles (division horizontal)",
    origen: "api-wcf-observado",
    fuente: "Consulta_DNPRC (bico.finca.ltp)",
    classification: "YES",
  },
  {
    literal: "Parcela con varios inmuebles (división horizontal)",
    origen: "faq-formato-cat",
    fuente: "https://www.catastro.hacienda.gob.es/documentos/preguntas_frecuentes_formato_CAT.pdf §6",
    classification: "YES",
  },
  {
    literal: "Derecho de superficie.",
    origen: "faq-formato-cat",
    fuente: "https://www.catastro.hacienda.gob.es/documentos/preguntas_frecuentes_formato_CAT.pdf §6",
    classification: "UNKNOWN",
  },
  {
    literal: "Inmueble de varios propietarios (Comunidad de propietarios).",
    origen: "faq-formato-cat",
    fuente: "https://www.catastro.hacienda.gob.es/documentos/preguntas_frecuentes_formato_CAT.pdf §6",
    classification: "UNKNOWN",
  },
  {
    literal: "Suelo sin edificar.",
    origen: "faq-formato-cat",
    fuente: "https://www.catastro.hacienda.gob.es/documentos/preguntas_frecuentes_formato_CAT.pdf §6",
    classification: "UNKNOWN",
  },
  {
    literal: "Parcela con un único inmueble.",
    origen: "faq-formato-cat",
    fuente: "https://www.catastro.hacienda.gob.es/documentos/preguntas_frecuentes_formato_CAT.pdf §6",
    classification: "UNKNOWN",
  },
  {
    literal: "Inmueble de propietario único.",
    origen: "faq-formato-cat",
    fuente: "https://www.catastro.hacienda.gob.es/documentos/preguntas_frecuentes_formato_CAT.pdf §6",
    classification: "UNKNOWN",
  },
];

export function normalizarLiteralLtp(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
