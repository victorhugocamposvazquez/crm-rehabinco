import { DOCUMENTO_PAGE_W } from "./documentos-pdf";
import {
  ALTURA_UTIL_PAGINA,
  MIN_HUECO_RELLENO,
  cssDocumentoPaginado,
  medirBloquesDocumento,
  prepararDocumentoExportHtml,
  repaginarDocumento,
  unirTextoFragmentos,
} from "./documentos-paginacion";
import type { ClausulaArrasKey, ClausulasPersonalizadasArras } from "./contrato-arras";

/**
 * Capa específica del contrato de arras sobre el motor genérico de paginación
 * (`documentos-paginacion.ts`): edición inline de cláusulas y sus estilos.
 */

export {
  alturaDeBloque,
  empaquetarBloquesEnPaginas,
  encontrarPrimerHuecoRellenable,
  esperarLayoutDocumento,
  fraccionarBloquesLargos,
  optimizarRellenoHuecos,
  partirSegmentosPorCaracteres,
  partirSegmentosPorPalabras,
  type BloqueMedido,
} from "./documentos-paginacion";

export const ALTURA_UTIL_PAGINA_ARRAS = ALTURA_UTIL_PAGINA;
export const MIN_HUECO_RELLENO_ARRAS = MIN_HUECO_RELLENO;

export const medirBloquesContratoArras = medirBloquesDocumento;
export const repaginarContratoArrasEnDocumento = repaginarDocumento;
export const prepararContratoArrasExportHtml = prepararDocumentoExportHtml;

/** @deprecated Usar prepararContratoArrasExportHtml */
export async function repaginarHtmlContratoArras(html: string): Promise<string> {
  return prepararDocumentoExportHtml(html);
}

export function normalizarTextoClausula(texto: string): string {
  return texto.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function clausulasPersonalizadasDesdeEdicion(
  editadas: ClausulasPersonalizadasArras,
  generadas: Record<ClausulaArrasKey, string>
): ClausulasPersonalizadasArras {
  const out: ClausulasPersonalizadasArras = {};
  for (const [key, texto] of Object.entries(editadas)) {
    const k = key as ClausulaArrasKey;
    const editado = normalizarTextoClausula(texto);
    const auto = normalizarTextoClausula(generadas[k] ?? "");
    if (editado && editado !== auto) out[k] = editado;
  }
  return out;
}

/**
 * Lee el texto de cada cláusula desde el documento editado. Una cláusula puede
 * estar partida en varios fragmentos (entre hojas); se reúnen respetando si el
 * corte fue a mitad de frase (espacio) o en un salto de línea.
 */
export function extraerClausulasDesdeDocumento(doc: Document): ClausulasPersonalizadasArras {
  const porClave = new Map<ClausulaArrasKey, HTMLElement[]>();
  doc.querySelectorAll<HTMLElement>("[data-clausula]").forEach((el) => {
    const key = el.dataset.clausula as ClausulaArrasKey | undefined;
    if (!key) return;
    const lista = porClave.get(key) ?? [];
    lista.push(el);
    porClave.set(key, lista);
  });
  const out: ClausulasPersonalizadasArras = {};
  for (const [key, elementos] of porClave) {
    const texto = unirTextoFragmentos(elementos);
    if (texto) out[key] = texto;
  }
  return out;
}

export function cssPreviewEditableArras(): string {
  return `
    ${cssDocumentoPaginado()}
    [data-clausula] {
      cursor: text;
      border-radius: 3px;
      transition: background 0.12s ease, box-shadow 0.12s ease;
    }
    [data-clausula]:hover {
      background: rgba(255, 250, 235, 0.85);
    }
    [data-clausula]:focus {
      outline: none;
      background: rgba(255, 248, 220, 0.95);
      box-shadow: inset 0 0 0 1px rgba(180, 140, 40, 0.45);
    }
    .pdf-flow {
      width: ${DOCUMENTO_PAGE_W}px;
    }
  `;
}

export function cssExportContratoArras(): string {
  return cssDocumentoPaginado();
}
