import { DOCUMENTO_PAGE_H, DOCUMENTO_PAGE_W } from "./documentos-pdf";
import type { ClausulaArrasKey, ClausulasPersonalizadasArras } from "./contrato-arras";

const PADDING_TOP = 54;
const PADDING_BOTTOM = 48;
const PADDING_X = 62;

/** Altura útil dentro de una hoja A4 simulada (px). */
export const ALTURA_UTIL_PAGINA_ARRAS = DOCUMENTO_PAGE_H - PADDING_TOP - PADDING_BOTTOM;

export type BloqueMedido = {
  el: HTMLElement;
  alto: number;
  evitarCorte: boolean;
  tituloSeccion: boolean;
};

export function medirBloquesContratoArras(doc: Document): BloqueMedido[] {
  const flow = doc.querySelector<HTMLElement>(".pdf-flow");
  if (!flow) return [];
  const bloques = Array.from(flow.querySelectorAll<HTMLElement>("[data-bloque]"));
  return bloques.map((el) => {
    const style = doc.defaultView?.getComputedStyle(el);
    const mt = style ? parseFloat(style.marginTop) || 0 : 0;
    const mb = style ? parseFloat(style.marginBottom) || 0 : 0;
    return {
      el,
      alto: el.offsetHeight + mt + mb,
      evitarCorte: el.dataset.evitarCorte === "1",
      tituloSeccion: el.dataset.tituloSeccion === "1",
    };
  });
}

/** Empaqueta bloques en páginas evitando títulos huérfanos al final de hoja. */
export function empaquetarBloquesEnPaginas(
  medidas: BloqueMedido[],
  alturaUtil = ALTURA_UTIL_PAGINA_ARRAS
): BloqueMedido[][] {
  const pages: BloqueMedido[][] = [];
  let actual: BloqueMedido[] = [];
  let altoActual = 0;

  const cerrarPagina = () => {
    if (actual.length) pages.push(actual);
    actual = [];
    altoActual = 0;
  };

  const cabeEnPagina = (alto: number) => altoActual + alto <= alturaUtil;

  for (let i = 0; i < medidas.length; i++) {
    const item = medidas[i];
    const siguiente = medidas[i + 1];

    if (
      item.tituloSeccion &&
      siguiente &&
      actual.length > 0 &&
      !cabeEnPagina(item.alto + siguiente.alto) &&
      item.alto + siguiente.alto <= alturaUtil
    ) {
      cerrarPagina();
    }

    if (item.evitarCorte && actual.length > 0 && !cabeEnPagina(item.alto)) {
      cerrarPagina();
    } else if (actual.length > 0 && !cabeEnPagina(item.alto) && item.alto <= alturaUtil) {
      cerrarPagina();
    }

    actual.push(item);
    altoActual += item.alto;
  }

  if (actual.length) pages.push(actual);
  return pages;
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

export function extraerClausulasDesdeDocumento(doc: Document): ClausulasPersonalizadasArras {
  const out: ClausulasPersonalizadasArras = {};
  doc.querySelectorAll<HTMLElement>("[data-clausula]").forEach((el) => {
    const key = el.dataset.clausula as ClausulaArrasKey | undefined;
    if (!key) return;
    const texto = (el.innerText || el.textContent || "").replace(/\u00a0/g, " ").trim();
    if (texto) out[key] = texto;
  });
  return out;
}

function crearPagina(doc: Document, extraClass = ""): HTMLDivElement {
  const page = doc.createElement("div");
  page.className = extraClass ? `pdf-page ${extraClass}` : "pdf-page";
  page.style.padding = `${PADDING_TOP}px ${PADDING_X}px ${PADDING_BOTTOM}px`;
  page.style.height = "auto";
  page.style.minHeight = "0";
  page.style.maxHeight = "none";
  return page;
}

/**
 * Reparte bloques medidos en hojas A4 solo para la previsualización en pantalla.
 * Impresión y PDF usan el flujo continuo (.pdf-flow) sin repaginar.
 */
export function repaginarContratoArrasEnDocumento(doc: Document): void {
  const flow = doc.querySelector<HTMLElement>(".pdf-flow");
  if (!flow) return;

  const medidas = medirBloquesContratoArras(doc);
  if (medidas.length === 0) return;

  const pages = empaquetarBloquesEnPaginas(medidas);
  const contenedor = flow.parentElement ?? doc.body;
  contenedor.querySelectorAll(".pdf-page").forEach((p) => p.remove());

  for (const pageData of pages) {
    const esFirmas = pageData.some((b) => b.el.classList.contains("pdf-firmas"));
    const page = crearPagina(doc, esFirmas ? "pdf-firmas" : "");
    for (const { el } of pageData) page.appendChild(el);
    contenedor.appendChild(page);
  }

  flow.remove();
}

/** Espera a que el iframe tenga layout estable antes de repaginar. */
export async function esperarLayoutDocumento(doc: Document): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  if (doc.fonts?.ready) await doc.fonts.ready.catch(() => undefined);
}

export function cssPreviewEditableArras(): string {
  return `
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
      background: #fff;
      box-sizing: border-box;
    }
    .pdf-page {
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
    }
  `;
}

export function cssExportContratoArras(): string {
  return `
    .pdf-flow {
      width: ${DOCUMENTO_PAGE_W}px;
      max-width: 100%;
      box-sizing: border-box;
      background: #fff;
    }
    [data-bloque] {
      break-inside: auto;
      page-break-inside: auto;
    }
    .pdf-firmas {
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    @media print {
      .pdf-flow {
        width: auto !important;
        padding: 0 !important;
      }
      .pdf-page {
        break-before: auto !important;
        break-after: auto !important;
        page-break-before: auto !important;
        page-break-after: auto !important;
      }
    }
  `;
}

/** Repagina el HTML de exportación en hojas medidas (PDF). */
export async function repaginarHtmlContratoArras(html: string): Promise<string> {
  if (typeof document === "undefined") return html;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-9999px",
    top: "0",
    width: "794px",
    height: "4000px",
    border: "0",
    visibility: "hidden",
  });
  document.body.appendChild(iframe);

  try {
    const idoc = iframe.contentDocument;
    if (!idoc) return html;
    idoc.open();
    idoc.write(html);
    idoc.close();
    await esperarLayoutDocumento(idoc);
    repaginarContratoArrasEnDocumento(idoc);
    return idoc.documentElement.outerHTML;
  } finally {
    iframe.remove();
  }
}
