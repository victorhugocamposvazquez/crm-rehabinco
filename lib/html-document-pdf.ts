import { FACTURA_HEADER_H, FACTURA_INK, FACTURA_MUTED, FACTURA_PAGE_W } from "@/lib/factura-pdf";

const PAGE_W_PX = FACTURA_PAGE_W;
const PAGE_H_PX = 1123;
const HEADER_W_PX = FACTURA_PAGE_W;
const HEADER_H_PX = FACTURA_HEADER_H;

export async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No se pudo cargar ${url}`);
  }
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar una imagen de la factura"));
    img.src = src;
  });
}

/** Cabecera minimal de la 1.ª hoja (logo + número + fecha). */
export async function composeInvoiceHeaderImage(params: {
  logoDataUrl: string;
  numeroLabel: string;
  fecha: string;
}): Promise<string> {
  const scale = 2;
  const W = HEADER_W_PX * scale;
  const H = HEADER_H_PX * scale;
  const padX = 48 * scale;
  const logo = await loadImage(params.logoDataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo generar la cabecera de la factura.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const maxLogoH = 52 * scale;
  const maxLogoW = 200 * scale;
  const ratio = logo.naturalWidth / Math.max(logo.naturalHeight, 1);
  let lh = maxLogoH;
  let lw = lh * ratio;
  if (lw > maxLogoW) {
    lw = maxLogoW;
    lh = lw / ratio;
  }
  const contentH = H - 4 * scale;
  ctx.drawImage(logo, padX, (contentH - lh) / 2, lw, lh);

  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = FACTURA_INK;
  ctx.font = `600 ${13 * scale}px "Segoe UI", system-ui, Helvetica, Arial, sans-serif`;
  ctx.fillText(params.numeroLabel.toUpperCase(), W - padX, contentH / 2 - 2 * scale);
  ctx.fillStyle = FACTURA_MUTED;
  ctx.font = `400 ${12 * scale}px "Segoe UI", system-ui, Helvetica, Arial, sans-serif`;
  ctx.fillText(params.fecha, W - padX, contentH / 2 + 16 * scale);

  ctx.fillStyle = FACTURA_INK;
  ctx.fillRect(0, H - 3 * scale, W, 3 * scale);

  return canvas.toDataURL("image/png");
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

/** Captura un HTML de 794px de ancho y lo guarda en PDF A4, hoja a hoja. */
export async function saveHtmlDocumentPdf(params: {
  html: string;
  filename: string;
  /** JPEG/PNG data URL 794×210; se pinta encima de la 1.ª hoja para que no se pierda en html2canvas. */
  firstPageBanner?: string;
}): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "PDF");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${PAGE_W_PX}px`,
    height: `${PAGE_H_PX * 4}px`,
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

  const headerEl = idoc.querySelector(".invoice-header") as HTMLElement | null;
  if (headerEl && params.firstPageBanner) {
    headerEl.style.display = "none";
  }

  await waitForImages(idoc);
  await new Promise((r) => setTimeout(r, 200));

  const captureEl =
    (params.firstPageBanner && (idoc.querySelector(".invoice-body") as HTMLElement | null)) ||
    idoc.body;
  const contentH = Math.max(captureEl.scrollHeight, captureEl.offsetHeight, 1);
  iframe.style.height = `${Math.max(contentH + HEADER_H_PX, PAGE_H_PX)}px`;

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const scale = 2;
    const canvas = await html2canvas(captureEl, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: PAGE_W_PX,
      windowWidth: PAGE_W_PX,
      windowHeight: contentH,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: 15000,
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = PAGE_W_PX * scale;
    const pageH = PAGE_H_PX * scale;
    const headerPx = params.firstPageBanner ? HEADER_H_PX * scale : 0;
    const headerMm = params.firstPageBanner ? (HEADER_H_PX / PAGE_W_PX) * 210 : 0;
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = pageW;
    pageCanvas.height = pageH;
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo generar el PDF. Inténtalo de nuevo.");

    let srcY = 0;
    let page = 0;
    while (srcY < canvas.height - 2) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageW, pageH);
      const destY = page === 0 ? headerPx : 0;
      const destH = pageH - destY;
      const take = Math.min(destH, canvas.height - srcY);
      ctx.drawImage(canvas, 0, srcY, canvas.width, take, 0, destY, pageW, take);
      const img = pageCanvas.toDataURL("image/jpeg", 0.95);
      if (page > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(img, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      if (page === 0 && params.firstPageBanner) {
        const bannerFmt = params.firstPageBanner.startsWith("data:image/png") ? "PNG" : "JPEG";
        pdf.addImage(params.firstPageBanner, bannerFmt, 0, 0, 210, headerMm);
      }
      srcY += take;
      page += 1;
    }

    pdf.save(params.filename);
  } finally {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
  }
}
