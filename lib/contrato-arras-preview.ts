import { htmlEsc } from "./empresa-documentos";
import { DOCUMENTO_PAGE_H, DOCUMENTO_PAGE_W } from "./documentos-pdf";
import type { ClausulaArrasKey, ClausulasPersonalizadasArras } from "./contrato-arras";

const PADDING_TOP = 54;
const PADDING_BOTTOM = 48;
const PADDING_X = 62;

/** Altura útil de contenido dentro de una hoja A4 simulada (px). */
export const ALTURA_UTIL_PAGINA_ARRAS = DOCUMENTO_PAGE_H - PADDING_TOP - PADDING_BOTTOM;

export type BloqueMedido = {
  el: HTMLElement;
  alto: number;
  evitarCorte: boolean;
  tituloSeccion: boolean;
};

export function alturaDeBloque(el: HTMLElement, doc: Document): number {
  const style = doc.defaultView?.getComputedStyle(el);
  const mt = style ? parseFloat(style.marginTop) || 0 : 0;
  const mb = style ? parseFloat(style.marginBottom) || 0 : 0;
  return el.offsetHeight + mt + mb;
}

export function medirBloquesContratoArras(doc: Document): BloqueMedido[] {
  const flow = doc.querySelector<HTMLElement>(".pdf-flow");
  if (!flow) return [];
  const bloques = Array.from(flow.querySelectorAll<HTMLElement>("[data-bloque]:not([data-probe])"));
  return bloques.map((el) => ({
    el,
    alto: alturaDeBloque(el, doc),
    evitarCorte: el.dataset.evitarCorte === "1",
    tituloSeccion: el.dataset.tituloSeccion === "1",
  }));
}

/** Parte un texto en segmentos que pasan la prueba de cabida (p. ej. altura medida). */
export function partirSegmentosPorPalabras(
  texto: string,
  cabe: (segmento: string) => boolean
): string[] {
  const limpio = texto.trim();
  if (!limpio) return [];
  if (cabe(limpio)) return [limpio];

  const palabras = limpio.split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];

  const out: string[] = [];
  let acum = "";

  for (const palabra of palabras) {
    const candidato = acum ? `${acum} ${palabra}` : palabra;
    if (cabe(candidato)) {
      acum = candidato;
      continue;
    }
    if (acum) {
      out.push(...partirSegmentosPorCaracteres(acum, cabe));
      acum = "";
    }
    if (cabe(palabra)) {
      acum = palabra;
    } else {
      out.push(...partirSegmentosPorCaracteres(palabra, cabe));
    }
  }
  if (acum) out.push(...partirSegmentosPorCaracteres(acum, cabe));
  return out.filter(Boolean);
}

/** Último recurso: parte carácter a carácter (URLs, tokens largos, etc.). */
export function partirSegmentosPorCaracteres(
  texto: string,
  cabe: (segmento: string) => boolean
): string[] {
  const limpio = texto.trim();
  if (!limpio) return [];
  if (cabe(limpio)) return [limpio];

  const out: string[] = [];
  let acum = "";
  for (const ch of limpio) {
    const candidato = acum + ch;
    if (cabe(candidato)) {
      acum = candidato;
      continue;
    }
    if (acum) out.push(acum);
    acum = ch;
  }
  if (acum) out.push(acum);
  return out.length ? out : [limpio.slice(0, 1)];
}

function medirInnerHtmlEnPlantilla(
  doc: Document,
  flow: HTMLElement,
  plantilla: HTMLElement,
  innerHtml: string
): number {
  const probe = plantilla.cloneNode(false) as HTMLElement;
  probe.innerHTML = innerHtml;
  probe.dataset.probe = "1";
  flow.appendChild(probe);
  const h = alturaDeBloque(probe, doc);
  probe.remove();
  return h;
}

function crearFragmentoDesdePlantilla(
  plantilla: HTMLElement,
  innerHtml: string,
  opts?: { quitarEdicion?: boolean }
): HTMLElement {
  const n = plantilla.cloneNode(false) as HTMLElement;
  n.innerHTML = innerHtml;
  if (opts?.quitarEdicion) n.removeAttribute("contenteditable");
  return n;
}

function dividirInnerHtmlEnFragmentos(
  plantilla: HTMLElement,
  innerHtml: string,
  doc: Document,
  flow: HTMLElement,
  maxAlto: number
): string[] {
  const limpio = innerHtml.trim();
  if (!limpio) return [];
  if (medirInnerHtmlEnPlantilla(doc, flow, plantilla, limpio) <= maxAlto) return [limpio];

  const segmentosBr = limpio.split(/<br\s*\/?>/gi).map((s) => s.trim()).filter(Boolean);
  if (segmentosBr.length > 1) {
    const out: string[] = [];
    let acum = "";
    for (const seg of segmentosBr) {
      const candidato = acum ? `${acum}<br />${seg}` : seg;
      if (medirInnerHtmlEnPlantilla(doc, flow, plantilla, candidato) <= maxAlto) {
        acum = candidato;
        continue;
      }
      if (acum) out.push(...dividirInnerHtmlEnFragmentos(plantilla, acum, doc, flow, maxAlto));
      out.push(...dividirInnerHtmlEnFragmentos(plantilla, seg, doc, flow, maxAlto));
      acum = "";
    }
    if (acum) out.push(acum);
    return out;
  }

  const plano = limpio.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const escapados = partirSegmentosPorPalabras(plano, (seg) =>
    medirInnerHtmlEnPlantilla(doc, flow, plantilla, htmlEsc(seg)) <= maxAlto
  ).map((seg) => htmlEsc(seg));
  if (escapados.length === 0 && plano) return [htmlEsc(plano.slice(0, 1))];
  return escapados;
}

function bloqueEsIndivisible(el: HTMLElement): boolean {
  return el.classList.contains("pdf-firmas") || el.dataset.evitarCorte === "1";
}

function bloqueEsPartible(el: HTMLElement): boolean {
  if (bloqueEsIndivisible(el)) return false;
  return el.tagName === "P" || el.tagName === "DIV";
}

/** Divide bloques más altos que una hoja en fragmentos medidos. */
export function fraccionarBloquesLargos(
  doc: Document,
  alturaUtil = ALTURA_UTIL_PAGINA_ARRAS,
  opts?: { quitarEdicion?: boolean }
): void {
  const flow = doc.querySelector<HTMLElement>(".pdf-flow");
  if (!flow) return;

  let cambio = true;
  while (cambio) {
    cambio = false;
    const originales = Array.from(flow.querySelectorAll<HTMLElement>("[data-bloque]:not([data-probe])"));
    for (const el of originales) {
      if (!bloqueEsPartible(el)) continue;
      if (alturaDeBloque(el, doc) <= alturaUtil) continue;

      let fragmentos = dividirInnerHtmlEnFragmentos(el, el.innerHTML, doc, flow, alturaUtil);
      if (fragmentos.length <= 1) {
        const plano = el.innerText.replace(/\s+/g, " ").trim();
        fragmentos = partirSegmentosPorCaracteres(plano, (seg) =>
          medirInnerHtmlEnPlantilla(doc, flow, el, htmlEsc(seg)) <= alturaUtil
        ).map((seg) => htmlEsc(seg));
      }
      if (fragmentos.length === 0) continue;

      const nodos = fragmentos.map((html) =>
        crearFragmentoDesdePlantilla(el, html, { quitarEdicion: opts?.quitarEdicion })
      );
      el.replaceWith(...nodos);
      cambio = true;
      break;
    }
  }
}

/** Empaqueta bloques en hojas evitando títulos huérfanos y huecos por bloques indivisibles. */
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
    } else if (actual.length > 0 && !cabeEnPagina(item.alto)) {
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
    if (!texto) return;
    out[key] = out[key] ? `${out[key]}\n${texto}` : texto;
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

export function repaginarContratoArrasEnDocumento(
  doc: Document,
  opts?: { fraccionar?: boolean; quitarEdicion?: boolean }
): void {
  const flow = doc.querySelector<HTMLElement>(".pdf-flow");
  if (!flow) return;

  if (opts?.fraccionar) {
    fraccionarBloquesLargos(doc, ALTURA_UTIL_PAGINA_ARRAS, { quitarEdicion: opts.quitarEdicion });
  }

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

export async function esperarLayoutDocumento(doc: Document): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  if (doc.fonts?.ready) await doc.fonts.ready.catch(() => undefined);
}

/** Pipeline completo: partir bloques largos + empaquetar hojas para imprimir/PDF. */
export async function prepararContratoArrasExportHtml(html: string): Promise<string> {
  if (typeof document === "undefined") return html;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-9999px",
    top: "0",
    width: `${DOCUMENTO_PAGE_W}px`,
    height: "8000px",
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
    repaginarContratoArrasEnDocumento(idoc, { fraccionar: true, quitarEdicion: true });
    return idoc.documentElement.outerHTML;
  } finally {
    iframe.remove();
  }
}

/** @deprecated Usar prepararContratoArrasExportHtml */
export async function repaginarHtmlContratoArras(html: string): Promise<string> {
  return prepararContratoArrasExportHtml(html);
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
      html, body {
        margin: 0 !important;
        padding: 0 !important;
      }
      .pdf-flow {
        display: none !important;
      }
      .pdf-page {
        width: auto !important;
        height: auto !important;
        margin: 0 !important;
        padding: ${PADDING_TOP}px ${PADDING_X}px ${PADDING_BOTTOM}px !important;
        overflow: visible !important;
        break-after: page;
        page-break-after: always;
        break-inside: avoid-page;
        page-break-inside: avoid;
      }
      .pdf-page:last-child {
        break-after: auto;
        page-break-after: auto;
      }
    }
  `;
}
