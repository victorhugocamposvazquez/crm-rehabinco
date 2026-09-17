const PAGE_W_PX = 794;
const PAGE_H_PX = 1123;

/** A4 a 96 dpi: 794 x 1123 px. Todo el pipeline (preview, PDF e impresión) mide con estas medidas. */
export const DOCUMENTO_PAGE_W = PAGE_W_PX;
export const DOCUMENTO_PAGE_H = PAGE_H_PX;

/** Margen interior de cada hoja. Va dentro de la hoja como padding, no como margen de @page. */
export const DOCUMENTO_PADDING = { top: 54, x: 62, bottom: 48 } as const;

export function cssPaginasDocumento(opts?: { serif?: boolean }) {
  const font = opts?.serif
    ? `'Times New Roman', Times, Georgia, serif`
    : `'Helvetica Neue', Helvetica, Arial, sans-serif`;
  const pad = `${DOCUMENTO_PADDING.top}px ${DOCUMENTO_PADDING.x}px ${DOCUMENTO_PADDING.bottom}px`;
  return `
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #1a1a1a;
      font-family: ${font};
    }
    strong, b { font-weight: 700; }
    .pdf-page {
      width: ${PAGE_W_PX}px;
      height: auto;
      overflow: hidden;
      position: relative;
      background: #fff;
    }
    .pdf-page + .pdf-page {
      border-top: 12px solid #d9d6cf;
    }
    @media print {
      /*
       * Las hojas ya vienen paginadas por JS a ${PAGE_W_PX}x${PAGE_H_PX} px con el margen
       * dentro como padding. Para que la impresión sea idéntica al PDF, cada .pdf-page
       * ocupa exactamente una hoja física: @page sin márgenes, ancho igual al de medida
       * (si el ancho cambiara, el texto envolvería distinto y se recortaría) y alto A4.
       * Sin márgenes de @page el navegador tampoco tiene sitio para pintar cabeceras.
       */
      @page {
        size: A4 portrait;
        margin: 0;
      }
      @page {
        @top-left { content: none; }
        @top-center { content: none; }
        @top-right { content: none; }
        @bottom-left { content: none; }
        @bottom-center { content: none; }
        @bottom-right { content: none; }
      }
      html, body {
        width: ${PAGE_W_PX}px;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #fff;
      }
      .pdf-page + .pdf-page { border-top: 0 !important; }
      .pdf-page {
        width: ${PAGE_W_PX}px !important;
        height: 297mm !important;
        min-height: 0 !important;
        max-height: none !important;
        margin: 0 !important;
        border: 0 !important;
        padding: ${pad} !important;
        overflow: hidden !important;
        break-after: page;
        page-break-after: always;
        break-inside: avoid-page;
        page-break-inside: avoid;
      }
      .pdf-page:last-child {
        height: auto !important;
        break-after: auto;
        page-break-after: auto;
      }
    }
  `;
}

export function envolverDocumentoHtml(params: {
  title: string;
  body: string;
  serif?: boolean;
  extraCss?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title> </title>
  <style>${cssPaginasDocumento({ serif: params.serif })}${params.extraCss ?? ""}</style>
</head>
<body><!-- ${params.title.replace(/</g, "")} -->${params.body}</body>
</html>`;
}

function waitForImages(doc: Document): Promise<void> {
  const imgs = Array.from(doc.images);
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        })
    )
  ).then(() => undefined);
}

function waitForLayout(doc: Document): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fonts = doc.fonts?.ready;
        if (fonts) {
          void fonts.then(() => resolve()).catch(() => resolve());
          return;
        }
        resolve();
      });
    });
  });
}

function normalizarHtmlImpresion(html: string): string {
  const trimmed = html.trimStart();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) return html;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8" /></head><body>${html}</body></html>`;
}

/** Captura un documento continuo y lo trocea en hojas A4 según la altura real del contenido. */
export async function downloadFlowingHtmlPdf(params: {
  html: string;
  filename: string;
  selector?: string;
}): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "PDF");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${PAGE_W_PX}px`,
    height: `${PAGE_H_PX * 8}px`,
    border: "0",
    opacity: "0.01",
    pointerEvents: "none",
    zIndex: "-1",
    background: "#fff",
  });
  document.body.appendChild(iframe);
  const idoc = iframe.contentDocument;
  if (!idoc) {
    document.body.removeChild(iframe);
    throw new Error("No se pudo generar el PDF. Inténtalo de nuevo.");
  }
  idoc.open();
  idoc.write(params.html);
  idoc.close();

  await waitForImages(idoc);
  await new Promise((r) => setTimeout(r, 200));

  const root = idoc.querySelector(params.selector ?? ".pdf-flow") as HTMLElement | null;
  if (!root) {
    document.body.removeChild(iframe);
    throw new Error("No se pudo generar el PDF. Inténtalo de nuevo.");
  }

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const scale = 2;
    const totalH = Math.max(root.scrollHeight, 1);
    iframe.style.height = `${totalH + 40}px`;

    const canvas = await html2canvas(root, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: PAGE_W_PX,
      height: totalH,
      windowWidth: PAGE_W_PX,
      windowHeight: totalH,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: 15000,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const sliceH = PAGE_H_PX * scale;
    let y = 0;
    let page = 0;

    while (y < canvas.height) {
      const h = Math.min(sliceH, canvas.height - y);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = h;
      const ctx = slice.getContext("2d");
      if (!ctx) break;
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      const img = slice.toDataURL("image/jpeg", 0.95);
      const imgHmm = (h / scale) * (297 / PAGE_H_PX);
      if (page > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(img, "JPEG", 0, 0, 210, imgHmm, undefined, "FAST");
      y += sliceH;
      page += 1;
    }

    pdf.save(params.filename);
  } finally {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }
}

/** Captura cada `.pdf-page` a A4. Con `ajustarAltura`, la hoja PDF se ajusta al contenido real. */
export async function downloadPagedHtmlPdf(params: {
  html: string;
  filename: string;
  ajustarAltura?: boolean;
}): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "PDF");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${PAGE_W_PX}px`,
    height: `${PAGE_H_PX * 6}px`,
    border: "0",
    opacity: "0.01",
    pointerEvents: "none",
    zIndex: "-1",
    background: "#fff",
  });
  document.body.appendChild(iframe);
  const idoc = iframe.contentDocument;
  if (!idoc) {
    document.body.removeChild(iframe);
    throw new Error("No se pudo generar el PDF. Inténtalo de nuevo.");
  }
  idoc.open();
  idoc.write(params.html);
  idoc.close();

  await waitForImages(idoc);
  await new Promise((r) => setTimeout(r, 200));

  const pages = Array.from(idoc.querySelectorAll(".pdf-page")) as HTMLElement[];
  if (pages.length === 0) {
    document.body.removeChild(iframe);
    throw new Error("No se pudo generar el PDF. Inténtalo de nuevo.");
  }

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const scale = 2;
    const ajustar = params.ajustarAltura === true;
    let pdfPage = 0;

    for (let i = 0; i < pages.length; i++) {
      for (let j = 0; j < pages.length; j++) {
        pages[j].style.display = j === i ? "block" : "none";
      }
      const page = pages[i];
      page.style.height = "auto";
      page.style.maxHeight = "none";
      page.style.overflow = "visible";

      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      const altoTotal = Math.max(page.scrollHeight, 1);
      iframe.style.height = `${altoTotal + 40}px`;

      const trozos = ajustar
        ? (() => {
            const out: number[] = [];
            let y = 0;
            while (y < altoTotal) {
              out.push(Math.min(PAGE_H_PX, altoTotal - y));
              y += PAGE_H_PX;
            }
            return out;
          })()
        : [PAGE_H_PX];

      for (let t = 0; t < trozos.length; t++) {
        const trozoH = trozos[t];
        const offsetY = ajustar ? trozos.slice(0, t).reduce((a, b) => a + b, 0) : 0;
        const canvas = await html2canvas(page, {
          scale,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          width: PAGE_W_PX,
          height: trozoH,
          y: offsetY,
          windowWidth: PAGE_W_PX,
          windowHeight: altoTotal,
          scrollX: 0,
          scrollY: -offsetY,
          imageTimeout: 15000,
        });
        const img = canvas.toDataURL("image/jpeg", 0.95);
        const imgHmm = ajustar ? (trozoH / PAGE_H_PX) * 297 : 297;
        if (pdfPage > 0) pdf.addPage("a4", "portrait");
        pdf.addImage(img, "JPEG", 0, 0, 210, imgHmm, undefined, "FAST");
        pdfPage += 1;
      }
    }

    pdf.save(params.filename);
  } finally {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }
}

/** Abre el diálogo de impresión del navegador con el HTML paginado. */
export function imprimirDocumentoHtml(html: string): Promise<void> {
  const docHtml = normalizarHtmlImpresion(html);

  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Imprimir");
    Object.assign(iframe.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: `${PAGE_W_PX}px`,
      height: `${PAGE_H_PX}px`,
      border: "0",
      background: "#fff",
    });
    document.body.appendChild(iframe);

    const idoc = iframe.contentDocument;
    if (!idoc) {
      iframe.remove();
      reject(new Error("No se pudo abrir la impresión."));
      return;
    }

    idoc.open();
    idoc.write(docHtml);
    idoc.close();

    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      reject(new Error("No se pudo abrir la impresión."));
      return;
    }

    idoc.title = " ";
    const titulo = idoc.querySelector("title");
    if (titulo) titulo.textContent = " ";
    idoc.documentElement.style.height = "auto";
    idoc.body.style.margin = "0";
    idoc.body.style.height = "auto";

    const limpiar = () => {
      iframe.remove();
      resolve();
    };

    win.addEventListener("afterprint", limpiar, { once: true });
    window.setTimeout(limpiar, 120000);

    requestAnimationFrame(() => {
      const altoContenido = Math.max(idoc.body.scrollHeight, idoc.documentElement.scrollHeight, 1);
      iframe.style.height = `${altoContenido}px`;
      try {
        win.focus();
        win.print();
      } catch (err) {
        iframe.remove();
        reject(err instanceof Error ? err : new Error("No se pudo abrir la impresión."));
      }
    });
  });
}

export function slugArchivo(texto: string, fallback: string) {
  const limpio = texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return limpio || fallback;
}
