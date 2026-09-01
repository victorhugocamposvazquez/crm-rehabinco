const PAGE_W_PX = 794;
const PAGE_H_PX = 1123;

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

  await waitForImages(idoc);
  await new Promise((r) => setTimeout(r, 200));

  const body = idoc.body;
  const contentH = Math.max(body.scrollHeight, PAGE_H_PX);
  iframe.style.height = `${contentH}px`;

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const scale = 2;
    const canvas = await html2canvas(body, {
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
    const sliceH = PAGE_H_PX * scale;
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = PAGE_W_PX * scale;
    pageCanvas.height = sliceH;
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo generar el PDF. Inténtalo de nuevo.");

    let y = 0;
    let page = 0;
    while (y < canvas.height - 2) {
      const h = Math.min(sliceH, canvas.height - y);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, y, pageCanvas.width, h, 0, 0, pageCanvas.width, h);
      const img = pageCanvas.toDataURL("image/jpeg", 0.95);
      if (page > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(img, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      y += sliceH;
      page += 1;
    }

    pdf.save(params.filename);
  } finally {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
  }
}
