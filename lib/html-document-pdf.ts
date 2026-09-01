const PAGE_W_PX = 794;
const PAGE_H_PX = 1123;
const HEADER_W_PX = 794;
const HEADER_H_PX = 210;

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

/** Cabecera de la 1.ª hoja: Torre de Hércules + logo blanco, ya recortados. */
export async function composeInvoiceHeaderImage(params: {
  fondoDataUrl: string;
  logoDataUrl: string;
  numeroLabel: string;
  fecha: string;
}): Promise<string> {
  const scale = 2;
  const W = HEADER_W_PX * scale;
  const H = HEADER_H_PX * scale;
  const [fondo, logo] = await Promise.all([
    loadImage(params.fondoDataUrl),
    loadImage(params.logoDataUrl),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo generar la cabecera de la factura.");

  ctx.fillStyle = "#0B1D2E";
  ctx.fillRect(0, 0, W, H);

  const cover = Math.max(W / fondo.naturalWidth, H / fondo.naturalHeight);
  const fw = fondo.naturalWidth * cover;
  const fh = fondo.naturalHeight * cover;
  ctx.drawImage(fondo, (W - fw) / 2, (H - fh) / 2, fw, fh);

  const overlay = ctx.createLinearGradient(0, 0, 0, H);
  overlay.addColorStop(0, "rgba(11,29,46,0.04)");
  overlay.addColorStop(0.75, "rgba(11,29,46,0.16)");
  overlay.addColorStop(1, "rgba(11,29,46,0.32)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);

  const maxLogoH = 180;
  const maxLogoW = 248;
  const ratio = logo.naturalWidth / Math.max(logo.naturalHeight, 1);
  let lh = maxLogoH;
  let lw = lh * ratio;
  if (lw > maxLogoW) {
    lw = maxLogoW;
    lh = lw / ratio;
  }
  ctx.drawImage(logo, 56, (H - lh) / 2, lw, lh);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = "600 28px Helvetica, Arial, sans-serif";
  ctx.fillText(params.numeroLabel, W - 56, H / 2 - 16);
  ctx.globalAlpha = 0.9;
  ctx.font = "400 24px Helvetica, Arial, sans-serif";
  ctx.fillText(params.fecha, W - 56, H / 2 + 22);
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/jpeg", 0.92);
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
        pdf.addImage(params.firstPageBanner, "JPEG", 0, 0, 210, headerMm);
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
