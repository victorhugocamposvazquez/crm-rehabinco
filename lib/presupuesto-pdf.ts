import { resolveInvoiceLogoUrl } from "@/lib/empresa-facturacion";
import type { EmisorPresupuesto } from "@/lib/emisores-presupuesto";

export type PlantillaPresupuesto = "default" | "cliente_branded" | "deportivo";

export type PresupuestoPdfCliente = {
  nombre: string;
  documento_fiscal?: string | null;
  tipo_documento?: string | null;
  tipo_cliente?: string | null;
  direccion?: string | null;
  codigo_postal?: string | null;
  localidad?: string | null;
  email?: string | null;
  telefono?: string | null;
  presupuesto_logo_url?: string | null;
  presupuesto_cabecera_url?: string | null;
  plantilla_presupuesto?: string | null;
};

export type PresupuestoPdfLinea = {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
};

export type PresupuestoPdfDatos = {
  numero: string;
  fecha: string | null;
  concepto: string | null;
  porcentaje_impuesto: number;
  importe_impuesto: number;
  porcentaje_descuento: number;
  importe_descuento: number;
  base_imponible: number;
  total: number;
  lineas: PresupuestoPdfLinea[];
};

export function resolvePlantillaPresupuesto(cliente: PresupuestoPdfCliente | null): PlantillaPresupuesto {
  if (cliente?.plantilla_presupuesto === "deportivo") return "deportivo";
  const logo = cliente?.presupuesto_logo_url?.trim();
  const cabecera = cliente?.presupuesto_cabecera_url?.trim();
  if (logo && cabecera) return "cliente_branded";
  return "default";
}

function htmlEsc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function formatFecha(fecha: string | null) {
  if (!fecha) return "—";
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function resolveAssetUrl(url: string | null | undefined, origin: string): string {
  return resolveInvoiceLogoUrl(url ?? "", origin);
}

function bloqueEmisor(emisor: EmisorPresupuesto) {
  const email = emisor.email
    ? `<p style="margin:0; font-weight:600;">${htmlEsc(emisor.email)}</p>`
    : "";
  const tel = emisor.telefono
    ? `<p style="margin:0; font-weight:600;">Tel. ${htmlEsc(emisor.telefono)}</p>`
    : "";
  const loc = [emisor.codigo_postal, emisor.localidad, emisor.provincia ? `(${emisor.provincia})` : ""]
    .filter((p) => p && p !== "()")
    .join(" ")
    .trim();
  return `
    <p style="margin:0 0 8px 0; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#333;">Emisor</p>
    <p style="margin:0; font-weight:600;">${htmlEsc(emisor.razon_social || emisor.nombre_corto)}</p>
    ${emisor.direccion ? `<p style="margin:0; font-weight:600;">${htmlEsc(emisor.direccion)}</p>` : ""}
    ${loc ? `<p style="margin:0; font-weight:600;">${htmlEsc(loc)}</p>` : ""}
    ${emisor.nif ? `<p style="margin:0; font-weight:600;">${htmlEsc(emisor.nif)}</p>` : ""}
    ${email}
    ${tel}
  `;
}

function bloqueCliente(cliente: PresupuestoPdfCliente | null) {
  if (!cliente) {
    return `
      <p style="margin:0 0 8px 0; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#333;">Destinatario</p>
      <p style="margin:0; font-weight:600;">—</p>
    `;
  }
  const docLabel = cliente.tipo_documento
    ? String(cliente.tipo_documento).toUpperCase()
    : cliente.tipo_cliente === "empresa"
      ? "NIF"
      : "DNI";
  const dirParts = [cliente.direccion, cliente.codigo_postal, cliente.localidad].filter(Boolean);
  return `
    <p style="margin:0 0 8px 0; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#333;">Destinatario</p>
    <p style="margin:0; font-weight:600;">${htmlEsc(cliente.nombre)}</p>
    ${dirParts.length ? `<p style="margin:0; font-weight:600;">${htmlEsc(dirParts.join(", "))}</p>` : ""}
    ${cliente.documento_fiscal ? `<p style="margin:0; font-weight:600;">${htmlEsc(docLabel)}: ${htmlEsc(cliente.documento_fiscal)}</p>` : ""}
    ${cliente.email ? `<p style="margin:0; font-weight:600;">${htmlEsc(cliente.email)}</p>` : ""}
    ${cliente.telefono ? `<p style="margin:0; font-weight:600;">${htmlEsc(cliente.telefono)}</p>` : ""}
  `;
}

function tablaLineas(datos: PresupuestoPdfDatos) {
  const ivaPct = Number(datos.porcentaje_impuesto ?? 21) || 0;
  const rows = datos.lineas
    .map((l, i) => {
      const base = Number(l.cantidad) * Number(l.precio_unitario);
      const ivaLinea = base * (ivaPct / 100);
      const totalLinea = base + ivaLinea;
      const bg = i % 2 === 1 ? "background:#f5f5f5;" : "";
      return `
        <tr style="${bg}">
          <td style="padding:12px 10px;border-bottom:1px solid #e5e5e5;">${htmlEsc(l.descripcion)}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #e5e5e5;text-align:right;">${Number(l.cantidad).toFixed(2)}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #e5e5e5;text-align:right;">${formatCurrency(base)}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #e5e5e5;text-align:right;">${formatCurrency(ivaLinea)}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #e5e5e5;text-align:right;">${formatCurrency(totalLinea)}</td>
        </tr>
      `;
    })
    .join("");

  const descuento = Number(datos.porcentaje_descuento) > 0
    ? `<p style="display:flex; justify-content:space-between; margin:6px 0;"><span>Descuento (${datos.porcentaje_descuento}%)</span><span>- ${formatCurrency(Number(datos.importe_descuento))}</span></p>`
    : "";

  return `
    <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
      <thead>
        <tr>
          <th style="padding:10px 8px; border-bottom:1px solid #ccc; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:#444;">Descripción</th>
          <th style="padding:10px 8px; border-bottom:1px solid #ccc; text-align:right; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:#444;">Cantidad</th>
          <th style="padding:10px 8px; border-bottom:1px solid #ccc; text-align:right; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:#444;">Base</th>
          <th style="padding:10px 8px; border-bottom:1px solid #ccc; text-align:right; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:#444;">IVA</th>
          <th style="padding:10px 8px; border-bottom:1px solid #ccc; text-align:right; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:#444;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-left:auto; width:260px; font-size:14px;">
      <p style="display:flex; justify-content:space-between; margin:6px 0;"><span>Base Imponible</span><span>${formatCurrency(Number(datos.base_imponible))}</span></p>
      <p style="display:flex; justify-content:space-between; margin:6px 0;"><span>IVA (${ivaPct}%)</span><span>${formatCurrency(Number(datos.importe_impuesto))}</span></p>
      ${descuento}
      <p style="display:flex; justify-content:space-between; margin:12px 0 0 0; padding-top:10px; border-top:1px solid #ccc; font-weight:700; font-size:16px;">
        <span>Total</span><span>${formatCurrency(Number(datos.total))}</span>
      </p>
    </div>
  `;
}

function pieOpcional(emisor: EmisorPresupuesto) {
  const parts: string[] = [];
  if (emisor.iban) parts.push(`IBAN: <strong>${htmlEsc(emisor.iban)}</strong>`);
  if (emisor.numero_cuenta_bancaria) {
    parts.push(`N.º de cuenta: <strong>${htmlEsc(emisor.numero_cuenta_bancaria)}</strong>`);
  }
  if (parts.length === 0) return "";
  return `
    <div style="margin-top:48px; padding-top:20px; border-top:1px solid #ddd;">
      <p style="margin:0; font-size:12px; color:#444; font-weight:500;">
        Forma de pago (si se acepta): transferencia. ${parts.join(" · ")}
      </p>
    </div>
  `;
}

function htmlPresupuestoDefault(
  emisor: EmisorPresupuesto,
  cliente: PresupuestoPdfCliente | null,
  datos: PresupuestoPdfDatos,
  origin: string
) {
  const logoUrl = resolveAssetUrl(emisor.logo_url, origin);
  const concepto = datos.concepto
    ? `<p style="margin:0 0 16px 0; font-size:13px; color:#444;">${htmlEsc(datos.concepto)}</p>`
    : "";
  return `
    <div style="max-width:100%; padding:0 4px;">
      <table style="width:100%; margin-bottom:24px; border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top; width:50%;">
            <img data-pdf-img src=${JSON.stringify(logoUrl)} alt="" style="height:48px; width:auto; max-width:220px; object-fit:contain;" />
          </td>
          <td style="vertical-align:top; width:50%; text-align:right;">
            <p style="margin:0; font-size:14px; font-weight:600;">PRESUPUESTO Nº: ${htmlEsc(datos.numero)}</p>
            <p style="margin:4px 0 0 0; font-size:13px; color:#444;">${htmlEsc(formatFecha(datos.fecha))}</p>
          </td>
        </tr>
      </table>
      ${concepto}
      <table style="width:100%; margin-bottom:24px; border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top; width:50%; padding-right:20px;">${bloqueEmisor(emisor)}</td>
          <td style="vertical-align:top; width:50%; text-align:right;">${bloqueCliente(cliente)}</td>
        </tr>
      </table>
      ${tablaLineas(datos)}
      ${pieOpcional(emisor)}
    </div>
  `;
}

function htmlPresupuestoClienteBranded(
  emisor: EmisorPresupuesto,
  cliente: PresupuestoPdfCliente,
  datos: PresupuestoPdfDatos,
  origin: string
) {
  const cabeceraUrl = resolveAssetUrl(cliente.presupuesto_cabecera_url, origin);
  const logoCliente = resolveAssetUrl(cliente.presupuesto_logo_url, origin);
  const logoEmisor = resolveAssetUrl(emisor.logo_url, origin);
  const concepto = datos.concepto
    ? `<p style="margin:0 0 16px 0; font-size:13px; color:#444;">${htmlEsc(datos.concepto)}</p>`
    : "";

  return `
    <div style="max-width:100%; padding:0;">
      <div style="margin:0 0 16px 0; overflow:hidden; border-radius:4px;">
        <img data-pdf-img src=${JSON.stringify(cabeceraUrl)} alt="" style="display:block; width:100%; max-height:120px; object-fit:cover;" />
      </div>
      <table style="width:100%; margin-bottom:16px; border-collapse:collapse; padding:0 4px;">
        <tr>
          <td style="vertical-align:middle; width:40%;">
            <img data-pdf-img src=${JSON.stringify(logoCliente)} alt="" style="height:44px; width:auto; max-width:180px; object-fit:contain;" />
          </td>
          <td style="vertical-align:middle; width:20%; text-align:center; font-size:11px; color:#666;">+</td>
          <td style="vertical-align:middle; width:40%; text-align:right;">
            <img data-pdf-img src=${JSON.stringify(logoEmisor)} alt="" style="height:44px; width:auto; max-width:180px; object-fit:contain;" />
          </td>
        </tr>
      </table>
      <div style="padding:0 4px;">
        <table style="width:100%; margin-bottom:20px; border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top; width:50%;">
              <p style="margin:0; font-size:14px; font-weight:600;">PRESUPUESTO Nº: ${htmlEsc(datos.numero)}</p>
            </td>
            <td style="vertical-align:top; width:50%; text-align:right;">
              <p style="margin:0; font-size:13px; color:#444;">${htmlEsc(formatFecha(datos.fecha))}</p>
            </td>
          </tr>
        </table>
        ${concepto}
        <table style="width:100%; margin-bottom:24px; border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top; width:50%; padding-right:20px;">${bloqueEmisor(emisor)}</td>
            <td style="vertical-align:top; width:50%; text-align:right;">${bloqueCliente(cliente)}</td>
          </tr>
        </table>
        ${tablaLineas(datos)}
        ${pieOpcional(emisor)}
      </div>
    </div>
  `;
}

/**
 * Punto de extensión: sustituir el HTML cuando exista la maquetación Deportivo + Garal.
 * En esta fase reutiliza la plantilla branded (cabecera + logos cliente/emisor).
 */
function htmlPresupuestoDeportivo(
  emisor: EmisorPresupuesto,
  cliente: PresupuestoPdfCliente,
  datos: PresupuestoPdfDatos,
  origin: string
) {
  return htmlPresupuestoClienteBranded(emisor, cliente, datos, origin);
}

export function buildPresupuestoDocumentHtml(params: {
  emisor: EmisorPresupuesto;
  cliente: PresupuestoPdfCliente | null;
  datos: PresupuestoPdfDatos;
  origin: string;
  plantilla?: PlantillaPresupuesto;
}): string {
  const plantilla = params.plantilla ?? resolvePlantillaPresupuesto(params.cliente);
  let inner: string;
  if (plantilla === "deportivo" && params.cliente) {
    inner = htmlPresupuestoDeportivo(params.emisor, params.cliente, params.datos, params.origin);
  } else if (plantilla === "cliente_branded" && params.cliente) {
    inner = htmlPresupuestoClienteBranded(params.emisor, params.cliente, params.datos, params.origin);
  } else {
    inner = htmlPresupuestoDefault(params.emisor, params.cliente, params.datos, params.origin);
  }

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${htmlEsc(params.datos.numero)}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color:#222; font-size:14px; line-height:1.5; margin:0; padding:8px; max-width:100%; box-sizing:border-box; }
      img[data-pdf-img] { max-width:100%; }
    </style>
  </head>
  <body>
    ${inner}
  </body>
</html>`;
}

export function presupuestoPdfFilename(numero: string) {
  const safeBase = numero.replace(/[\\/:*?"<>|]+/g, "-");
  return `Presupuesto-${safeBase}.pdf`;
}

function waitForPdfImages(doc: Document): Promise<void> {
  const imgs = Array.from(doc.querySelectorAll("img[data-pdf-img]")) as HTMLImageElement[];
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalHeight > 0) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        })
    )
  ).then(() => undefined);
}

export async function downloadPresupuestoPdf(params: {
  html: string;
  filename: string;
}): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "PDF presupuesto");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "794px",
    minHeight: "1123px",
    opacity: "0",
    pointerEvents: "none",
    zIndex: "-1",
    border: "0",
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

  await waitForPdfImages(idoc);
  await new Promise((r) => setTimeout(r, 100));

  try {
    const mod = await import("html2pdf.js");
    const html2pdf = mod.default;
    await html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        filename: params.filename,
        image: { type: "jpeg", quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(idoc.body)
      .save();
  } finally {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
  }
}
