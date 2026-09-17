import { htmlEsc } from "./empresa-documentos";
import { DOCUMENTO_PADDING, DOCUMENTO_PAGE_H, DOCUMENTO_PAGE_W } from "./documentos-pdf";

/**
 * Motor de paginación de documentos.
 *
 * Un documento se emite como un `.pdf-flow` con bloques `[data-bloque]`. Este módulo
 * mide cada bloque en el DOM real, parte los que no caben y los empaqueta en hojas
 * `.pdf-page` de tamaño A4. La misma salida sirve para previsualizar, generar el PDF
 * e imprimir, así los tres coinciden.
 *
 * Atributos que entiende:
 *  - data-bloque="1"          unidad mínima de paginación (obligatorio).
 *  - data-titulo-seccion="1"  no se deja solo al final de una hoja.
 *  - data-evitar-corte="1"    indivisible (p. ej. firmas).
 *  - data-clausula="clave"    identidad lógica; se conserva al partir un bloque.
 *  - data-union="br|sp"       marca interna: cómo se une un fragmento al anterior.
 */

/**
 * Tolerancia entre la medida en pantalla y el render final. Cubre redondeos
 * de sub-píxel (297mm = 1122,5px) y pequeñas diferencias de motor. Cuesta una
 * línea por hoja y evita que la última línea de una hoja se recorte en silencio.
 */
export const MARGEN_SEGURIDAD_PAGINA = 20;

/** Altura útil de contenido dentro de una hoja A4 (px). */
export const ALTURA_UTIL_PAGINA =
  DOCUMENTO_PAGE_H - DOCUMENTO_PADDING.top - DOCUMENTO_PADDING.bottom - MARGEN_SEGURIDAD_PAGINA;

/** Hueco mínimo (px) para intentar partir el bloque siguiente y rellenarlo. */
export const MIN_HUECO_RELLENO = 56;

export type BloqueMedido = {
  el: HTMLElement;
  alto: number;
  evitarCorte: boolean;
  tituloSeccion: boolean;
};

export type UnionFragmento = "br" | "sp";

export type Fragmento = {
  html: string;
  /** Separador que había entre este fragmento y el anterior en el bloque original. */
  union: UnionFragmento;
};

export function alturaDeBloque(el: HTMLElement, doc: Document): number {
  const style = doc.defaultView?.getComputedStyle(el);
  const mt = style ? parseFloat(style.marginTop) || 0 : 0;
  const mb = style ? parseFloat(style.marginBottom) || 0 : 0;
  return el.offsetHeight + mt + mb;
}

export function medirBloquesDocumento(doc: Document): BloqueMedido[] {
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

/** Texto plano (entidades decodificadas) y negritas de un innerHTML. */
function analizarInnerHtml(doc: Document, innerHtml: string): { plano: string; negritas: string[] } {
  const tmp = doc.createElement("div");
  tmp.innerHTML = innerHtml.replace(/<br\s*\/?>/gi, " ");
  const negritas = Array.from(tmp.querySelectorAll("strong, b"))
    .map((n) => (n.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const plano = (tmp.textContent ?? "").replace(/\s+/g, " ").trim();
  return { plano, negritas };
}

/** Escapa un texto y vuelve a poner en negrita los fragmentos indicados. */
export function aplicarNegritas(texto: string, negritas: string[]): string {
  let html = htmlEsc(texto);
  const unicos = [...new Set(negritas.map((n) => n.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const n of unicos) {
    const esc = htmlEsc(n);
    html = html.split(esc).join(`<strong>${esc}</strong>`);
  }
  return html;
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
  fragmento: Fragmento,
  opts?: { quitarEdicion?: boolean; primero?: boolean }
): HTMLElement {
  const n = plantilla.cloneNode(false) as HTMLElement;
  n.innerHTML = fragmento.html;
  if (opts?.quitarEdicion) n.removeAttribute("contenteditable");
  if (opts?.primero) delete n.dataset.union;
  else n.dataset.union = fragmento.union;
  return n;
}

function fragmentosPorPalabras(
  doc: Document,
  flow: HTMLElement,
  plantilla: HTMLElement,
  innerHtml: string,
  maxAlto: number
): Fragmento[] {
  const { plano, negritas } = analizarInnerHtml(doc, innerHtml);
  if (!plano) return [];
  const render = (seg: string) => aplicarNegritas(seg, negritas);
  const partes = partirSegmentosPorPalabras(plano, (seg) =>
    medirInnerHtmlEnPlantilla(doc, flow, plantilla, render(seg)) <= maxAlto
  );
  if (partes.length === 0) return [{ html: render(plano.slice(0, 1)), union: "sp" }];
  return partes.map((seg) => ({ html: render(seg), union: "sp" }));
}

/**
 * Divide un innerHTML en fragmentos que caben en `maxAlto`. Primero por saltos
 * `<br>` (manteniendo el HTML), y si no basta, por palabras (texto plano
 * conservando negritas). Cada fragmento recuerda cómo se unía al anterior.
 */
export function dividirInnerHtmlEnFragmentos(
  plantilla: HTMLElement,
  innerHtml: string,
  doc: Document,
  flow: HTMLElement,
  maxAlto: number
): Fragmento[] {
  const limpio = innerHtml.trim();
  if (!limpio) return [];
  if (medirInnerHtmlEnPlantilla(doc, flow, plantilla, limpio) <= maxAlto) {
    return [{ html: limpio, union: "sp" }];
  }

  const segmentosBr = limpio.split(/<br\s*\/?>/gi).map((s) => s.trim()).filter(Boolean);
  if (segmentosBr.length > 1) {
    const out: Fragmento[] = [];
    let acum = "";
    const volcar = (frags: Fragmento[]) => {
      if (!frags.length) return;
      out.push({ ...frags[0], union: "br" }, ...frags.slice(1));
    };
    for (const seg of segmentosBr) {
      const candidato = acum ? `${acum}<br />${seg}` : seg;
      if (medirInnerHtmlEnPlantilla(doc, flow, plantilla, candidato) <= maxAlto) {
        acum = candidato;
        continue;
      }
      if (acum) {
        volcar(dividirInnerHtmlEnFragmentos(plantilla, acum, doc, flow, maxAlto));
        acum = "";
      }
      if (medirInnerHtmlEnPlantilla(doc, flow, plantilla, seg) <= maxAlto) {
        acum = seg;
      } else {
        volcar(dividirInnerHtmlEnFragmentos(plantilla, seg, doc, flow, maxAlto));
      }
    }
    if (acum) volcar([{ html: acum, union: "br" }]);
    return out;
  }

  return fragmentosPorPalabras(doc, flow, plantilla, limpio, maxAlto);
}

function bloqueEsIndivisible(el: HTMLElement): boolean {
  return el.classList.contains("pdf-firmas") || el.dataset.evitarCorte === "1";
}

function bloqueEsPartible(el: HTMLElement): boolean {
  if (bloqueEsIndivisible(el)) return false;
  return el.tagName === "P" || el.tagName === "DIV";
}

function unirFragmentos(frags: Fragmento[]): string {
  return frags
    .map((f, i) => (i === 0 ? f.html : `${f.union === "br" ? "<br />" : " "}${f.html}`))
    .join("");
}

/** Parte un bloque en dos: cabecera que cabe en `espacioRestante` y resto. */
function partirBloqueAlEspacioRestante(
  el: HTMLElement,
  espacioRestante: number,
  doc: Document,
  flow: HTMLElement,
  opts?: { quitarEdicion?: boolean }
): boolean {
  if (espacioRestante < MIN_HUECO_RELLENO) return false;
  if (!bloqueEsPartible(el)) return false;
  if (alturaDeBloque(el, doc) <= espacioRestante) return false;

  let frags = dividirInnerHtmlEnFragmentos(el, el.innerHTML, doc, flow, espacioRestante);
  if (frags.length <= 1) {
    frags = fragmentosPorPalabras(doc, flow, el, el.innerHTML, espacioRestante);
    if (frags.length <= 1) return false;
  }

  const primero = frags[0];
  const restoFrags = frags.slice(1);
  const resto: Fragmento = { html: unirFragmentos(restoFrags).trim(), union: restoFrags[0].union };
  if (!primero.html.trim() || !resto.html) return false;

  // Si el bloque ya era un fragmento, conserva cómo se unía al anterior.
  const unionPrevia = el.dataset.union as UnionFragmento | undefined;
  const cabeza = crearFragmentoDesdePlantilla(el, primero, { ...opts, primero: !unionPrevia });
  if (unionPrevia) cabeza.dataset.union = unionPrevia;
  el.replaceWith(cabeza, crearFragmentoDesdePlantilla(el, resto, opts));
  return true;
}

/** Detecta el primer hueco rellenable tras simular el empaquetado (sin DOM). */
export function encontrarPrimerHuecoRellenable(
  medidas: BloqueMedido[],
  alturaUtil = ALTURA_UTIL_PAGINA,
  minHueco = MIN_HUECO_RELLENO
): { indiceBloque: number; espacioRestante: number } | null {
  const pages = empaquetarBloquesEnPaginas(medidas, alturaUtil);
  for (let p = 0; p < pages.length - 1; p++) {
    const altoPagina = pages[p].reduce((s, b) => s + b.alto, 0);
    const restante = alturaUtil - altoPagina;
    if (restante < minHueco) continue;
    const next = pages[p + 1]?.[0];
    if (!next || next.evitarCorte || next.tituloSeccion) continue;
    if (next.alto <= restante) continue;
    const idx = medidas.indexOf(next);
    if (idx >= 0) return { indiceBloque: idx, espacioRestante: restante };
  }
  return null;
}

/** Itera empaquetado + partición para rellenar huecos entre hojas. */
export function optimizarRellenoHuecos(
  doc: Document,
  alturaUtil = ALTURA_UTIL_PAGINA,
  opts?: { quitarEdicion?: boolean }
): void {
  const flow = doc.querySelector<HTMLElement>(".pdf-flow");
  if (!flow) return;

  for (let iter = 0; iter < 80; iter++) {
    const medidas = medirBloquesDocumento(doc);
    const hueco = encontrarPrimerHuecoRellenable(medidas, alturaUtil);
    if (!hueco) return;

    const bloque = medidas[hueco.indiceBloque]?.el;
    if (!bloque) return;
    if (!partirBloqueAlEspacioRestante(bloque, hueco.espacioRestante, doc, flow, opts)) return;
  }
}

/** Divide bloques más altos que una hoja en fragmentos medidos. */
export function fraccionarBloquesLargos(
  doc: Document,
  alturaUtil = ALTURA_UTIL_PAGINA,
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
        const { plano, negritas } = analizarInnerHtml(doc, el.innerHTML);
        fragmentos = partirSegmentosPorCaracteres(plano, (seg) =>
          medirInnerHtmlEnPlantilla(doc, flow, el, aplicarNegritas(seg, negritas)) <= alturaUtil
        ).map((seg) => ({ html: aplicarNegritas(seg, negritas), union: "sp" as const }));
      }
      if (fragmentos.length === 0) continue;

      const unionPrevia = el.dataset.union as UnionFragmento | undefined;
      const nodos = fragmentos.map((f, i) =>
        crearFragmentoDesdePlantilla(el, f, { quitarEdicion: opts?.quitarEdicion, primero: i === 0 && !unionPrevia })
      );
      if (unionPrevia) nodos[0].dataset.union = unionPrevia;
      el.replaceWith(...nodos);
      cambio = true;
      break;
    }
  }
}

/** Empaqueta bloques en hojas evitando títulos huérfanos y huecos por bloques indivisibles. */
export function empaquetarBloquesEnPaginas(
  medidas: BloqueMedido[],
  alturaUtil = ALTURA_UTIL_PAGINA
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

/**
 * Reconstruye el texto de una serie de fragmentos del mismo bloque lógico
 * (p. ej. una cláusula partida entre dos hojas), respetando cómo se unían.
 */
export function unirTextoFragmentos(elementos: HTMLElement[]): string {
  let out = "";
  for (const el of elementos) {
    const texto = (el.innerText || el.textContent || "").replace(/\u00a0/g, " ").trim();
    if (!texto) continue;
    if (!out) {
      out = texto;
      continue;
    }
    out += (el.dataset.union === "br" ? "\n" : " ") + texto;
  }
  return out;
}

function crearPagina(doc: Document, extraClass = ""): HTMLDivElement {
  const page = doc.createElement("div");
  page.className = extraClass ? `pdf-page ${extraClass}` : "pdf-page";
  page.style.padding = `${DOCUMENTO_PADDING.top}px ${DOCUMENTO_PADDING.x}px ${DOCUMENTO_PADDING.bottom}px`;
  page.style.height = "auto";
  page.style.minHeight = "0";
  page.style.maxHeight = "none";
  return page;
}

/** Convierte el `.pdf-flow` del documento en hojas `.pdf-page` (in situ). */
export function repaginarDocumento(
  doc: Document,
  opts?: { fraccionar?: boolean; quitarEdicion?: boolean }
): void {
  const flow = doc.querySelector<HTMLElement>(".pdf-flow");
  if (!flow) return;

  if (opts?.fraccionar) {
    const fraccOpts = { quitarEdicion: opts.quitarEdicion };
    fraccionarBloquesLargos(doc, ALTURA_UTIL_PAGINA, fraccOpts);
    optimizarRellenoHuecos(doc, ALTURA_UTIL_PAGINA, fraccOpts);
    fraccionarBloquesLargos(doc, ALTURA_UTIL_PAGINA, fraccOpts);
  }

  const medidas = medirBloquesDocumento(doc);
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
export async function prepararDocumentoExportHtml(html: string): Promise<string> {
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
    repaginarDocumento(idoc, { fraccionar: true, quitarEdicion: true });
    await esperarLayoutDocumento(idoc);
    return `<!DOCTYPE html>\n${idoc.documentElement.outerHTML}`;
  } finally {
    iframe.remove();
  }
}

/** Envuelve los bloques de un documento en el `.pdf-flow` que espera el motor. */
export function envolverFlujoDocumento(bloques: string): string {
  return `<div class="pdf-flow" style="padding:${DOCUMENTO_PADDING.top}px ${DOCUMENTO_PADDING.x}px ${DOCUMENTO_PADDING.bottom}px;">${bloques}</div>`;
}

/** CSS común a cualquier documento que pase por el motor. */
export function cssDocumentoPaginado(): string {
  return `
    .pdf-flow {
      width: ${DOCUMENTO_PAGE_W}px;
      max-width: 100%;
      box-sizing: border-box;
      background: #fff;
    }
    .pdf-page {
      height: auto;
      min-height: 0;
      max-height: none;
    }
    [data-bloque] {
      break-inside: auto;
      page-break-inside: auto;
      /* Tokens sin espacios (URLs, referencias) se envuelven en vez de desbordar la hoja. */
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .pdf-firmas, [data-evitar-corte="1"] {
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    @media print {
      .pdf-flow {
        display: none !important;
      }
    }
  `;
}
