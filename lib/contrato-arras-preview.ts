import { DOCUMENTO_PAGE_H } from "./documentos-pdf";
import type { ClausulaArrasKey, ClausulasPersonalizadasArras } from "./contrato-arras";

const PADDING_TOP = 54;
const PADDING_BOTTOM = 48;
const PADDING_X = 62;

/** Altura útil dentro de una hoja A4 simulada (px). */
export const ALTURA_UTIL_PAGINA_ARRAS = DOCUMENTO_PAGE_H - PADDING_TOP - PADDING_BOTTOM;

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

export function textoPlanoDesdeHtml(html: string): string {
  const div = typeof document !== "undefined" ? document.createElement("div") : null;
  if (!div) return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
  div.innerHTML = html;
  return (div.innerText || div.textContent || "").replace(/\u00a0/g, " ").trim();
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
  return page;
}

/**
 * Reparte bloques medidos en hojas A4. Se usa en previsualización y antes de generar el PDF.
 */
export function repaginarContratoArrasEnDocumento(doc: Document): void {
  const flow = doc.querySelector<HTMLElement>(".pdf-flow");
  if (!flow) return;

  const bloques = Array.from(flow.querySelectorAll<HTMLElement>("[data-bloque]"));
  if (bloques.length === 0) return;

  const medidas = bloques.map((b) => {
    const style = doc.defaultView?.getComputedStyle(b);
    const mt = style ? parseFloat(style.marginTop) || 0 : 0;
    const mb = style ? parseFloat(style.marginBottom) || 0 : 0;
    return { el: b, alto: b.offsetHeight + mt + mb, evitarCorte: b.dataset.evitarCorte === "1" };
  });

  const pages: Array<{ nodes: HTMLElement[]; alto: number; firmas: boolean }> = [];
  let actual: { nodes: HTMLElement[]; alto: number; firmas: boolean } = { nodes: [], alto: 0, firmas: false };

  const nuevaPagina = () => {
    if (actual.nodes.length) pages.push(actual);
    actual = { nodes: [], alto: 0, firmas: false };
  };

  for (const { el, alto, evitarCorte } of medidas) {
    const esFirmas = el.classList.contains("pdf-firmas");
    if (actual.alto + alto > ALTURA_UTIL_PAGINA_ARRAS && actual.nodes.length > 0) {
      if (evitarCorte && actual.nodes.length > 0) {
        nuevaPagina();
      } else if (!evitarCorte) {
        nuevaPagina();
      }
    }
    actual.nodes.push(el);
    actual.alto += alto;
    if (esFirmas) actual.firmas = true;
  }
  if (actual.nodes.length) pages.push(actual);

  const contenedor = flow.parentElement ?? doc.body;
  contenedor.querySelectorAll(".pdf-page").forEach((p) => p.remove());

  for (const pageData of pages) {
    const page = crearPagina(doc, pageData.firmas ? "pdf-firmas" : "");
    for (const node of pageData.nodes) page.appendChild(node);
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
    .pdf-flow { width: 794px; background: #fff; }
  `;
}
