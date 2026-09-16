const PAGE_W_PX = 794;
const PAGE_H_PX = 1123;

export const DOCUMENTO_PAGE_W = PAGE_W_PX;
export const DOCUMENTO_PAGE_H = PAGE_H_PX;

export function cssPaginasDocumento(opts?: { serif?: boolean }) {
  const font = opts?.serif
    ? `'Times New Roman', Times, Georgia, serif`
    : `'Helvetica Neue', Helvetica, Arial, sans-serif`;
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
      height: ${PAGE_H_PX}px;
      overflow: hidden;
      position: relative;
      background: #fff;
    }
    .pdf-page + .pdf-page {
      border-top: 12px solid #d9d6cf;
    }
    @media print {
      @page { size: A4; margin: 0; }
      .pdf-page + .pdf-page { border-top: 0; }
      .pdf-page { break-after: page; page-break-after: always; }
      .pdf-page:last-child { break-after: auto; page-break-after: auto; }
    }
  `;
}

export function envolverDocumentoHtml(params: {
  title: string;
  body: string;
  serif?: boolean;
}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${params.title.replace(/</g, "")}</title>
  <style>${cssPaginasDocumento({ serif: params.serif })}</style>
</head>
<body>${params.body}</body>
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

/** Captura cada `.pdf-page` a A4. */
export async function downloadPagedHtmlPdf(params: {
  html: string;
  filename: string;
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
    iframe.style.height = `${PAGE_H_PX}px`;

    for (let i = 0; i < pages.length; i++) {
      for (let j = 0; j < pages.length; j++) {
        pages[j].style.display = j === i ? "block" : "none";
      }
      const page = pages[i];
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: PAGE_W_PX,
        height: PAGE_H_PX,
        windowWidth: PAGE_W_PX,
        windowHeight: PAGE_H_PX,
        scrollX: 0,
        scrollY: 0,
        imageTimeout: 15000,
      });
      const img = canvas.toDataURL("image/jpeg", 0.95);
      if (i > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(img, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }

    pdf.save(params.filename);
  } finally {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }
}

/** Abre el diálogo de impresión del navegador con el HTML paginado. */
export async function imprimirDocumentoHtml(html: string): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Imprimir");
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
    iframe.remove();
    throw new Error("No se pudo abrir la impresión.");
  }
  idoc.open();
  idoc.write(html);
  idoc.close();

  await waitForImages(idoc);
  await new Promise((r) => setTimeout(r, 150));

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    throw new Error("No se pudo abrir la impresión.");
  }

  const cerrar = () => {
    win.removeEventListener("afterprint", cerrar);
    iframe.remove();
  };
  win.addEventListener("afterprint", cerrar);
  window.setTimeout(cerrar, 120000);
  win.focus();
  win.print();
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
