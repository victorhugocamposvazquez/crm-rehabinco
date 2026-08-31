import { resolveInvoiceLogoUrl } from "@/lib/empresa-facturacion";
import type { EmisorPresupuesto } from "@/lib/emisores-presupuesto";
import {
  parsePropuesta,
  propuestaVacia,
  type PropuestaPresupuesto,
} from "@/lib/presupuesto-propuesta";

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
  unidad?: string | null;
  capitulo?: string | null;
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
  propuesta?: PropuestaPresupuesto | null;
};

const NAVY = "#0B1D2E";
const MUTED = "#8A8A8A";
const LINE = "#E4E4E4";

const ASSETS = {
  garalBlanco: "/images/presupuestos/garal-blanco.png",
  garalNegro: "/images/presupuestos/garal-negro.png",
  deportivoBlanco: "/images/presupuestos/deportivo-blanco.png",
  deportivoNegro: "/images/presupuestos/deportivo-negro.png",
  fondoRiazor: "/images/presupuestos/fondo-riazor-a4.jpg",
} as const;

type PdfCtx = {
  origin: string;
  emisor: EmisorPresupuesto;
  cliente: PresupuestoPdfCliente | null;
  esGaral: boolean;
  esDeportivo: boolean;
  propuesta: PropuestaPresupuesto;
};

export function esClienteDeportivo(cliente: PresupuestoPdfCliente | null): boolean {
  if (!cliente) return false;
  if (cliente.plantilla_presupuesto === "deportivo") return true;
  return /deportivo/i.test(cliente.nombre ?? "");
}

export function resolvePlantillaPresupuesto(cliente: PresupuestoPdfCliente | null): PlantillaPresupuesto {
  if (esClienteDeportivo(cliente)) return "deportivo";
  const logo = cliente?.presupuesto_logo_url?.trim();
  const cabecera = cliente?.presupuesto_cabecera_url?.trim();
  if (logo && cabecera) return "cliente_branded";
  return "default";
}

function absAsset(origin: string, path: string) {
  return `${origin}${path}`;
}

function htmlEsc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlMultiline(s: string) {
  return htmlEsc(s).replace(/\n/g, "<br />");
}

function hasAsset(url: string | null | undefined) {
  return Boolean(url?.trim());
}

function formatCurrency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function formatNum(value: number) {
  return value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFechaPuntos(fecha: string | null) {
  if (!fecha) return "—";
  const d = new Date(fecha + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd} · ${mm} · ${d.getFullYear()}`;
}

function formatFechaLarga(fecha: string | null) {
  if (!fecha) return "—";
  const d = new Date(fecha + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function resolveAssetUrl(url: string | null | undefined, origin: string): string {
  return resolveInvoiceLogoUrl(url ?? "", origin);
}

function emplazamiento(cliente: PresupuestoPdfCliente | null) {
  if (!cliente) return "—";
  const parts = [cliente.direccion, cliente.codigo_postal, cliente.localidad].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

function contacto(cliente: PresupuestoPdfCliente | null) {
  if (!cliente) return "—";
  const parts = [cliente.email, cliente.telefono].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

const PAGE_W_PX = 794;
const PAGE_H_PX = 1123;

function logoImg(src: string, w: number, h: number, align: "left" | "right") {
  const margin = align === "right" ? "margin-left:auto;" : "";
  const pos = align === "right" ? "right center" : "left center";
  return `<div style="width:${w}px;height:${h}px;${margin}overflow:hidden;">
    <img data-pdf-img src=${JSON.stringify(src)} alt="" width="${w}" height="${h}"
      style="width:${w}px;height:${h}px;object-fit:contain;object-position:${pos};display:block;border:0;" />
  </div>`;
}

function logoEmisorUrl(ctx: PdfCtx, invert: boolean): string | null {
  if (ctx.esGaral) {
    return absAsset(ctx.origin, invert ? ASSETS.garalBlanco : ASSETS.garalNegro);
  }
  if (hasAsset(ctx.emisor.logo_url)) return resolveAssetUrl(ctx.emisor.logo_url, ctx.origin);
  return null;
}

function logoClienteUrl(ctx: PdfCtx, invert: boolean): string | null {
  if (ctx.esDeportivo) {
    return absAsset(ctx.origin, invert ? ASSETS.deportivoBlanco : ASSETS.deportivoNegro);
  }
  if (hasAsset(ctx.cliente?.presupuesto_logo_url)) {
    return resolveAssetUrl(ctx.cliente?.presupuesto_logo_url, ctx.origin);
  }
  return null;
}

function marcaEmisor(ctx: PdfCtx, opts?: { invert?: boolean; cover?: boolean }) {
  const invert = Boolean(opts?.invert);
  const color = invert ? "#fff" : NAVY;
  const sub = invert ? "rgba(255,255,255,0.72)" : MUTED;
  const src = logoEmisorUrl(ctx, invert);
  if (src) {
    if (ctx.esGaral) {
      return opts?.cover ? logoImg(src, 150, 48, "left") : logoImg(src, 119, 38, "left");
    }
    return opts?.cover ? logoImg(src, 180, 48, "left") : logoImg(src, 160, 42, "left");
  }
  const emisor = ctx.emisor;
  return `
    <div style="font-size:13px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:${color}; line-height:1.25;">
      ${htmlEsc(emisor.nombre_corto || emisor.razon_social)}
    </div>
    ${emisor.razon_social && emisor.razon_social !== emisor.nombre_corto
      ? `<div style="margin-top:3px; font-size:8px; letter-spacing:0.16em; text-transform:uppercase; color:${sub};">${htmlEsc(emisor.razon_social)}</div>`
      : ""}
  `;
}

function marcaCliente(ctx: PdfCtx, opts?: { invert?: boolean; cover?: boolean }) {
  const invert = Boolean(opts?.invert);
  const color = invert ? "#fff" : NAVY;
  const sub = invert ? "rgba(255,255,255,0.7)" : MUTED;
  const nombre = ctx.cliente?.nombre?.trim() || "Cliente";
  const src = logoClienteUrl(ctx, invert);
  let img: string;
  if (src && ctx.esDeportivo) {
    img = opts?.cover ? logoImg(src, 200, 22, "right") : logoImg(src, 190, 21, "right");
  } else if (src) {
    img = opts?.cover ? logoImg(src, 180, 40, "right") : logoImg(src, 150, 36, "right");
  } else {
    img = `<div style="font-size:${opts?.cover ? 15 : 12}px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:${color}; line-height:1.3;">${htmlEsc(nombre)}</div>`;
  }
  const etiqueta = src
    ? ctx.esDeportivo
      ? "Cliente · Estadio Abanca-Riazor"
      : `Cliente · ${nombre}`
    : "Cliente";
  return `
    <div style="text-align:right;">
      ${img}
      <div style="margin-top:6px; font-size:8px; letter-spacing:0.18em; text-transform:uppercase; color:${sub};">
        ${htmlEsc(etiqueta)}
      </div>
    </div>
  `;
}

function cabeceraInterior(ctx: PdfCtx, datos: PresupuestoPdfDatos, hoja: string) {
  return `
    <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
      <tr>
        <td style="width:32%; vertical-align:middle;">${marcaEmisor(ctx)}</td>
        <td style="width:36%; vertical-align:middle; text-align:center; font-size:8px; letter-spacing:0.16em; text-transform:uppercase; color:${MUTED};">
          Presupuesto ${htmlEsc(datos.numero)} · Hoja ${htmlEsc(hoja)}
        </td>
        <td style="width:32%; vertical-align:middle;">${marcaCliente(ctx)}</td>
      </tr>
    </table>
    <div style="height:1px; background:${LINE}; margin-bottom:28px;"></div>
  `;
}

function pieInterior(left: string, hoja: string) {
  return `
    <div class="pdf-footer">
      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="font-size:8px; letter-spacing:0.14em; text-transform:uppercase; color:${MUTED}; padding-top:12px; border-top:1px solid ${LINE};">${htmlEsc(left)}</td>
          <td style="text-align:right; font-size:8px; letter-spacing:0.14em; text-transform:uppercase; color:${MUTED}; padding-top:12px; border-top:1px solid ${LINE};">Hoja ${htmlEsc(hoja)}</td>
        </tr>
      </table>
    </div>
  `;
}

function datoCelda(label: string, value: string, right?: boolean) {
  return `
    <td style="width:50%; vertical-align:top; padding:14px 16px; ${right ? "border-left:1px solid " + LINE + ";" : ""}">
      <div style="font-size:8px; letter-spacing:0.16em; text-transform:uppercase; color:${MUTED}; margin-bottom:6px;">${htmlEsc(label)}</div>
      <div style="font-size:13px; font-weight:700; color:#111; line-height:1.35;">${htmlEsc(value)}</div>
    </td>
  `;
}

function htmlPortada(ctx: PdfCtx, datos: PresupuestoPdfDatos) {
  const p = ctx.propuesta;
  const titulo = (datos.concepto || "Presupuesto").trim();
  const cabeceraCliente = hasAsset(ctx.cliente?.presupuesto_cabecera_url);
  let fondo = "";
  if (ctx.esDeportivo) {
    const src = absAsset(ctx.origin, ASSETS.fondoRiazor);
    fondo = `<img data-pdf-img class="pdf-cover-bg" src=${JSON.stringify(src)} alt="" width="${PAGE_W_PX}" height="${PAGE_H_PX}" />`;
  } else if (cabeceraCliente) {
    const src = resolveAssetUrl(ctx.cliente?.presupuesto_cabecera_url, ctx.origin);
    fondo = `<img data-pdf-img class="pdf-cover-bg" src=${JSON.stringify(src)} alt="" width="${PAGE_W_PX}" height="${PAGE_H_PX}" style="object-fit:cover; object-position:center top;" />
       <div style="position:absolute; left:0; top:0; width:${PAGE_W_PX}px; height:${PAGE_H_PX}px; background:linear-gradient(180deg, rgba(11,29,46,0.35) 0%, rgba(11,29,46,0.55) 48%, ${NAVY} 62%, ${NAVY} 100%);"></div>`;
  } else {
    fondo = `<div class="pdf-cover-bg" style="background:
         linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
         linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px),
         ${NAVY};
         background-size: 28px 28px, 28px 28px, auto;"></div>`;
  }

  const escalaHoja = `${p.escala?.trim() || "1:1000"} · 01/04`;

  return `
    <div class="pdf-page pdf-cover">
      ${fondo}
      <div class="pdf-page-inner pdf-cover-inner">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="width:50%; vertical-align:top;">${marcaEmisor(ctx, { invert: true, cover: true })}</td>
            <td style="width:50%; vertical-align:top;">${marcaCliente(ctx, { invert: true, cover: true })}</td>
          </tr>
        </table>
        <div class="pdf-cover-spacer"></div>
        <div style="padding-bottom:8mm;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:18px;">
            <div style="flex:1; height:1px; background:rgba(255,255,255,0.35);"></div>
            <div style="font-size:9px; letter-spacing:0.22em; text-transform:uppercase; white-space:nowrap;">Propuesta técnica y económica</div>
          </div>
          <div style="font-size:36px; font-weight:700; line-height:1.12; letter-spacing:-0.02em; white-space:pre-wrap;">${htmlEsc(titulo)}</div>
          ${p.subtitulo_portada.trim() ? `<div style="margin-top:8px; font-size:22px; font-weight:600; line-height:1.2;">${htmlEsc(p.subtitulo_portada.trim())}</div>` : ""}
          ${p.descripcion_portada.trim() ? `<p style="margin:16px 0 0; max-width:92%; font-size:13px; line-height:1.5; font-weight:400; opacity:0.92;">${htmlMultiline(p.descripcion_portada.trim())}</p>` : ""}
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.28); padding-top:12px;">
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="width:25%; vertical-align:top; padding-right:10px;">
                <div style="font-size:7px; letter-spacing:0.18em; text-transform:uppercase; opacity:0.65; margin-bottom:6px;">N.º presupuesto</div>
                <div style="font-size:13px; font-weight:600;">${htmlEsc(datos.numero)}</div>
              </td>
              <td style="width:25%; vertical-align:top; padding:0 10px; border-left:1px solid rgba(255,255,255,0.2);">
                <div style="font-size:7px; letter-spacing:0.18em; text-transform:uppercase; opacity:0.65; margin-bottom:6px;">Fecha</div>
                <div style="font-size:13px; font-weight:600;">${htmlEsc(formatFechaPuntos(datos.fecha))}</div>
              </td>
              <td style="width:25%; vertical-align:top; padding:0 10px; border-left:1px solid rgba(255,255,255,0.2);">
                <div style="font-size:7px; letter-spacing:0.18em; text-transform:uppercase; opacity:0.65; margin-bottom:6px;">Redactado por</div>
                <div style="font-size:13px; font-weight:600;">${htmlEsc(ctx.emisor.nombre_corto || ctx.emisor.razon_social)}</div>
              </td>
              <td style="width:25%; vertical-align:top; padding-left:10px; border-left:1px solid rgba(255,255,255,0.2);">
                <div style="font-size:7px; letter-spacing:0.18em; text-transform:uppercase; opacity:0.65; margin-bottom:6px;">Escala · Hoja</div>
                <div style="font-size:13px; font-weight:600;">${htmlEsc(escalaHoja)}</div>
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  `;
}

function htmlZonas(zonas: PropuestaPresupuesto["zonas"]) {
  const items = zonas.filter((z) => z.titulo.trim() || z.descripcion.trim() || z.codigo.trim());
  if (items.length === 0) {
    return `<p style="margin:0; font-size:13px; color:#666;">Sin zonas definidas.</p>`;
  }
  const cell = (z: (typeof items)[0], idx: number) => {
    const codigo = z.codigo.trim() || `Z-${String(idx + 1).padStart(2, "0")}`;
    return `
      <td style="width:50%; vertical-align:top; padding:0 18px 20px 0;">
        <div style="font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#6A9BB0; font-weight:700; margin-bottom:6px;">${htmlEsc(codigo)}</div>
        <div style="font-size:14px; font-weight:700; margin-bottom:4px;">${htmlEsc(z.titulo.trim() || "—")}</div>
        <div style="font-size:12px; line-height:1.45; color:#333;">${z.descripcion.trim() ? htmlMultiline(z.descripcion.trim()) : ""}</div>
      </td>
    `;
  };
  let tableRows = "";
  for (let i = 0; i < items.length; i += 2) {
    const right = items[i + 1];
    tableRows += `<tr>${cell(items[i], i)}${right ? cell(right, i + 1) : `<td style="width:50%;"></td>`}</tr>`;
  }
  return `<table style="width:100%; border-collapse:collapse;">${tableRows}</table>`;
}

function htmlDatos(ctx: PdfCtx, datos: PresupuestoPdfDatos) {
  const cliente = ctx.cliente;
  const emisor = ctx.emisor;
  const p = ctx.propuesta;
  const docLabel = cliente?.tipo_documento
    ? String(cliente.tipo_documento).toUpperCase()
    : cliente?.tipo_cliente === "empresa"
      ? "CIF"
      : "DNI";
  const emplaz = p.emplazamiento.trim() || emplazamiento(cliente);
  const cont = p.contacto.trim() || contacto(cliente);
  const objeto = (p.objeto_alcance.trim() || datos.concepto?.trim() || "").trim();
  const objetoHtml = objeto
    ? htmlMultiline(objeto)
    : "La presente propuesta define la actuación presupuestada, estableciendo partidas, mediciones, importes y condiciones de ejecución.";

  return `
    <div class="pdf-page">
      <div class="pdf-page-inner">
      ${cabeceraInterior(ctx, datos, "02")}
      <h2 style="margin:0 0 14px; font-size:18px; font-weight:700;">1. Datos del presupuesto</h2>
      <table style="width:100%; border-collapse:collapse; border:1px solid ${LINE}; margin-bottom:28px;">
        <tr style="border-bottom:1px solid ${LINE};">
          ${datoCelda("Cliente", cliente?.nombre ?? "—")}
          ${datoCelda(docLabel, cliente?.documento_fiscal?.trim() || "—", true)}
        </tr>
        <tr style="border-bottom:1px solid ${LINE};">
          ${datoCelda("Emplazamiento", emplaz)}
          ${datoCelda("Contacto", cont, true)}
        </tr>
        <tr>
          ${datoCelda("Plazo de ejecución", p.plazo_ejecucion.trim() || "—")}
          ${datoCelda("Validez de la oferta", p.validez_oferta.trim() || "30 días naturales", true)}
        </tr>
      </table>
      <h2 style="margin:0 0 12px; font-size:18px; font-weight:700;">2. Objeto y alcance</h2>
      <p style="margin:0 0 28px; font-size:13px; line-height:1.55; color:#222;">${objetoHtml}</p>
      <h2 style="margin:0 0 14px; font-size:18px; font-weight:700;">3. Zonas de intervención</h2>
      ${htmlZonas(p.zonas)}
      </div>
      ${pieInterior(`${emisor.razon_social || emisor.nombre_corto}`, "02 / 04")}
    </div>
  `;
}

function htmlMediciones(ctx: PdfCtx, datos: PresupuestoPdfDatos) {
  const ivaPct = Number(datos.porcentaje_impuesto ?? 21) || 0;
  const groups = new Map<string, PresupuestoPdfLinea[]>();
  for (const l of datos.lineas) {
    const key = l.capitulo?.trim() || "";
    const arr = groups.get(key) ?? [];
    arr.push(l);
    groups.set(key, arr);
  }

  let globalIdx = 0;
  const body: string[] = [];
  for (const [capitulo, items] of groups) {
    if (capitulo) {
      body.push(`
        <tr>
          <td colspan="6" style="padding:10px 8px 6px; background:#f3f3f3; font-size:9px; letter-spacing:0.14em; text-transform:uppercase; color:#666; font-weight:700;">
            ${htmlEsc(capitulo)}
          </td>
        </tr>
      `);
    }
    items.forEach((l) => {
      globalIdx += 1;
      const cant = Number(l.cantidad);
      const precio = Number(l.precio_unitario);
      const importe = cant * precio;
      const cod = `${Math.floor((globalIdx - 1) / 99) + 1}.${String(((globalIdx - 1) % 99) + 1).padStart(2, "0")}`;
      const ud = (l.unidad || "ud").trim() || "ud";
      body.push(`
        <tr>
          <td style="padding:9px 8px; border-bottom:1px solid ${LINE}; font-size:11px; color:#555; white-space:nowrap;">${htmlEsc(cod)}</td>
          <td style="padding:9px 8px; border-bottom:1px solid ${LINE}; font-size:12px;">${htmlEsc(l.descripcion)}</td>
          <td style="padding:9px 8px; border-bottom:1px solid ${LINE}; font-size:11px; text-align:center;">${htmlEsc(ud)}</td>
          <td style="padding:9px 8px; border-bottom:1px solid ${LINE}; font-size:12px; text-align:right;">${formatNum(cant)}</td>
          <td style="padding:9px 8px; border-bottom:1px solid ${LINE}; font-size:12px; text-align:right;">${formatNum(precio)}</td>
          <td style="padding:9px 8px; border-bottom:1px solid ${LINE}; font-size:12px; text-align:right; font-weight:600;">${formatNum(importe)}</td>
        </tr>
      `);
    });
  }

  const descuento =
    Number(datos.porcentaje_descuento) > 0
      ? `<tr>
          <td style="padding:6px 0; color:#444;">Baja ofertada −${formatNum(Number(datos.porcentaje_descuento))} %</td>
          <td style="padding:6px 0; text-align:right;">− ${formatCurrency(Number(datos.importe_descuento))}</td>
        </tr>`
      : "";

  return `
    <div class="pdf-page">
      <div class="pdf-page-inner">
      ${cabeceraInterior(ctx, datos, "03")}
      <h2 style="margin:0 0 14px; font-size:18px; font-weight:700;">4. Mediciones y presupuesto</h2>
      <table style="width:100%; border-collapse:collapse; margin-bottom:22px;">
        <thead>
          <tr style="background:#111; color:#fff;">
            <th style="padding:8px; text-align:left; font-size:8px; letter-spacing:0.12em; font-weight:600;">Cód.</th>
            <th style="padding:8px; text-align:left; font-size:8px; letter-spacing:0.12em; font-weight:600;">Descripción de la partida</th>
            <th style="padding:8px; text-align:center; font-size:8px; letter-spacing:0.12em; font-weight:600;">Ud</th>
            <th style="padding:8px; text-align:right; font-size:8px; letter-spacing:0.12em; font-weight:600;">Cant.</th>
            <th style="padding:8px; text-align:right; font-size:8px; letter-spacing:0.12em; font-weight:600;">Precio</th>
            <th style="padding:8px; text-align:right; font-size:8px; letter-spacing:0.12em; font-weight:600;">Importe</th>
          </tr>
        </thead>
        <tbody>${body.join("")}</tbody>
      </table>
      <table style="width:280px; margin-left:auto; border-collapse:collapse; font-size:13px;">
        <tr>
          <td style="padding:6px 0; color:#444;">Base imponible</td>
          <td style="padding:6px 0; text-align:right;">${formatCurrency(Number(datos.base_imponible))}</td>
        </tr>
        ${descuento}
        <tr>
          <td style="padding:6px 0; color:#444;">IVA ${ivaPct} %</td>
          <td style="padding:6px 0; text-align:right;">${formatCurrency(Number(datos.importe_impuesto))}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:0; padding-top:8px;">
            <div style="background:#111; color:#fff; padding:10px 12px; font-weight:700; display:flex; justify-content:space-between; letter-spacing:0.08em; font-size:12px;">
              <span>TOTAL OFERTA</span>
              <span>${formatCurrency(Number(datos.total))}</span>
            </div>
          </td>
        </tr>
      </table>
      </div>
      ${pieInterior("Importes en euros · IVA no incluido en las partidas", "03 / 04")}
    </div>
  `;
}

function htmlPrograma(programa: PropuestaPresupuesto["programa"]) {
  const items = programa.filter((f) => f.codigo.trim() || f.descripcion.trim());
  if (items.length === 0) {
    return `<p style="margin:0 0 28px; font-size:13px; color:#666;">Sin programa definido.</p>`;
  }
  return `
    <table style="width:100%; border-collapse:collapse; margin-bottom:28px;">
      ${items
        .map(
          (f) => `
        <tr>
          <td style="width:88px; vertical-align:top; padding:10px 12px 10px 0; border-bottom:1px solid ${LINE}; font-size:12px; font-weight:700; color:#6A9BB0; letter-spacing:0.06em; white-space:nowrap;">
            ${htmlEsc(f.codigo.trim() || "—")}
          </td>
          <td style="vertical-align:top; padding:10px 0; border-bottom:1px solid ${LINE}; font-size:13px; color:#222;">
            ${htmlEsc(f.descripcion.trim())}
          </td>
        </tr>`
        )
        .join("")}
    </table>
  `;
}

function htmlCierre(ctx: PdfCtx, datos: PresupuestoPdfDatos) {
  const emisor = ctx.emisor;
  const p = ctx.propuesta;
  const lugar = emisor.localidad?.trim() || "A Coruña";
  const fechaLarga = formatFechaLarga(datos.fecha).toUpperCase();
  return `
    <div class="pdf-page">
      <div class="pdf-page-inner">
      ${cabeceraInterior(ctx, datos, "04")}
      <h2 style="margin:0 0 12px; font-size:18px; font-weight:700;">5. Programa de trabajos</h2>
      ${htmlPrograma(p.programa)}
      <h2 style="margin:0 0 12px; font-size:18px; font-weight:700;">6. Condiciones y garantías</h2>
      <p style="margin:0 0 36px; font-size:13px; line-height:1.55; color:#222;">${htmlMultiline(p.condiciones.trim())}</p>
      <table style="width:100%; border-collapse:collapse; margin-top:48px;">
        <tr>
          <td style="width:48%; vertical-align:top; padding-right:4%;">
            <div style="font-size:8px; letter-spacing:0.16em; text-transform:uppercase; color:${MUTED}; margin-bottom:28px;">Por ${htmlEsc(emisor.nombre_corto || emisor.razon_social)}</div>
            <div style="border-top:1px solid #111; padding-top:8px; font-size:12px; font-weight:600;">
              ${htmlEsc(emisor.razon_social || emisor.nombre_corto)} · Dirección técnica
            </div>
          </td>
          <td style="width:48%; vertical-align:top; padding-left:4%;">
            <div style="font-size:8px; letter-spacing:0.16em; text-transform:uppercase; color:${MUTED}; margin-bottom:28px;">Conforme, el cliente</div>
            <div style="border-top:1px solid #111; padding-top:8px; font-size:12px; color:#444;">
              Nombre, cargo y fecha
            </div>
          </td>
        </tr>
      </table>
      </div>
      ${pieInterior(`En ${lugar}, a ${fechaLarga}`, "04 / 04")}
    </div>
  `;
}

export function buildPresupuestoDocumentHtml(params: {
  emisor: EmisorPresupuesto;
  cliente: PresupuestoPdfCliente | null;
  datos: PresupuestoPdfDatos;
  origin: string;
  plantilla?: PlantillaPresupuesto;
}): string {
  void params.plantilla;
  const ctx: PdfCtx = {
    origin: params.origin,
    emisor: params.emisor,
    cliente: params.cliente,
    esGaral: params.emisor.slug === "garal",
    esDeportivo: esClienteDeportivo(params.cliente),
    propuesta: parsePropuesta(params.datos.propuesta ?? propuestaVacia()),
  };
  const inner =
    htmlPortada(ctx, params.datos) +
    htmlDatos(ctx, params.datos) +
    htmlMediciones(ctx, params.datos) +
    htmlCierre(ctx, params.datos);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${htmlEsc(params.datos.numero)}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin:0; padding:0; }
      body { font-family: Helvetica, Arial, sans-serif; color:#111; font-size:13px; line-height:1.45; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      h2 { font-family: Helvetica, Arial, sans-serif; }
      img[data-pdf-img] { display:block; border:0; }
      .pdf-page {
        width: ${PAGE_W_PX}px;
        height: ${PAGE_H_PX}px;
        overflow: hidden;
        position: relative;
        background: #fff;
      }
      .pdf-cover { background: ${NAVY}; color: #fff; }
      .pdf-cover-bg {
        position: absolute;
        left: 0;
        top: 0;
        width: ${PAGE_W_PX}px;
        height: ${PAGE_H_PX}px;
        display: block;
        border: 0;
      }
      .pdf-page-inner { position: relative; z-index: 1; box-sizing: border-box; height: 100%; padding: 52px 60px 72px; }
      .pdf-cover-inner { display: flex; flex-direction: column; padding: 68px 60px 52px; }
      .pdf-cover-spacer { flex: 1 1 auto; min-height: 120px; }
      .pdf-footer { position: absolute; left: 60px; right: 60px; bottom: 44px; z-index: 1; }
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
    width: `${PAGE_W_PX}px`,
    height: `${PAGE_H_PX * 5}px`,
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

  await waitForPdfImages(idoc);
  await new Promise((r) => setTimeout(r, 250));

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
      const isCover = page.classList.contains("pdf-cover");
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: isCover ? NAVY : "#ffffff",
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
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
  }
}
