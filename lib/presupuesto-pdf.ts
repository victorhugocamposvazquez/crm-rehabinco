import { resolveInvoiceLogoUrl } from "@/lib/empresa-facturacion";
import type { EmisorPresupuesto } from "@/lib/emisores-presupuesto";
import {
  codigoPartida,
  parsePropuesta,
  propuestaVacia,
  type DensidadTabla,
  type PropuestaPresupuesto,
} from "@/lib/presupuesto-propuesta";
import { esLineaRepercusion, totalesAmpliacion } from "@/lib/presupuesto-totales";

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

function hojaCorta(n: number) {
  return String(n).padStart(2, "0");
}

function hojaTxt(n: number, total: number) {
  return `${hojaCorta(n)} / ${hojaCorta(total)}`;
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

const GARAL_MONO = "'Courier New', Courier, monospace";

const GARAL_SEDES = {
  exposicion: ["Ronda de Nelle 133", "15010 A Coruña", "Tlfno. 981 265 638"],
  fabrica: ["M. Rabadeira, Nave 09", "Plg. Nostián, 15008", "A Coruña"],
  contacto: ["www.armariosgaral.com", "garaldesde1988@gmail.com"],
} as const;

const REHABINCO_SEDES = {
  direccion: ["C/ de la Merced, 57 bjo.", "La Coruña", "Tel. 664 859 306"],
  contacto: ["www.rehabinco.com", "oficina@rehabinco.com"],
} as const;

function garalCoverLabel(text: string) {
  return `<div style="font-family:${GARAL_MONO};font-size:8px;letter-spacing:0.22em;text-transform:uppercase;opacity:0.68;margin-bottom:8px;white-space:nowrap;">${htmlEsc(text)}</div>`;
}

function garalCoverValue(text: string) {
  return `<div style="font-family:${GARAL_MONO};font-size:13px;line-height:1.4;">${htmlEsc(text)}</div>`;
}

function garalCoverLines(lines: readonly string[]) {
  return `<div style="font-family:${GARAL_MONO};font-size:12px;line-height:1.45;">${lines.map((l) => htmlEsc(l)).join("<br />")}</div>`;
}

function htmlMarcoTecnico() {
  const mark = (pos: string) =>
    `<span style="position:absolute;${pos};font-family:${GARAL_MONO};font-size:11px;line-height:1;opacity:0.85;">+</span>`;
  return `
    <div class="pdf-cover-frame" style="position:absolute;left:18px;top:18px;right:18px;bottom:18px;border:1px solid rgba(255,255,255,0.42);pointer-events:none;z-index:2;">
      ${mark("left:-5px;top:-8px")}
      ${mark("right:-5px;top:-8px")}
      ${mark("left:-5px;bottom:-8px")}
      ${mark("right:-5px;bottom:-8px")}
    </div>
  `;
}

function totAmpliacion(ctx: PdfCtx, datos: PresupuestoPdfDatos) {
  return totalesAmpliacion({
    lineas: datos.lineas.map((l) => ({
      descripcion: l.descripcion,
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precio_unitario),
      capitulo: l.capitulo,
    })),
    bajas: ctx.propuesta.bajas,
    ajusteComercial: ctx.propuesta.ajuste_comercial,
    origenTotal: ctx.propuesta.origen_total,
    porcentajeImpuesto: Number(datos.porcentaje_impuesto),
  });
}

function htmlPortadaPie(ctx: PdfCtx, datos: PresupuestoPdfDatos) {
  const p = ctx.propuesta;
  const ampliacion = ctx.propuesta.tipo === "ampliacion";
  const tot = ampliacion ? totAmpliacion(ctx, datos) : null;
  const totalTxt = ampliacion
    ? `${formatCurrency(tot!.incrementoNeto)} + IVA`
    : `${formatCurrency(Number(datos.base_imponible))} + IVA`;
  const validez = p.validez_oferta.trim() || "30 días naturales";
  const hr = `border-top:1px solid rgba(255,255,255,0.32);`;
  const bloques = ctx.esGaral
    ? [
        { label: "Exposición y venta", lines: GARAL_SEDES.exposicion },
        { label: "Fábrica", lines: GARAL_SEDES.fabrica },
        { label: "Contacto", lines: GARAL_SEDES.contacto },
      ]
    : [
        { label: "Dirección", lines: REHABINCO_SEDES.direccion },
        { label: "Contacto", lines: REHABINCO_SEDES.contacto },
      ];
  const colW = `${Math.floor(100 / bloques.length)}%`;
  return `
    <div style="${hr}padding-top:14px;font-family:${GARAL_MONO};color:#fff;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        <tr>
          <td style="width:25%;vertical-align:top;padding-right:10px;">
            ${garalCoverLabel("N.º presupuesto")}
            ${garalCoverValue(datos.numero)}
          </td>
          <td style="width:22%;vertical-align:top;padding:0 10px;">
            ${garalCoverLabel("Fecha")}
            ${garalCoverValue(formatFechaPuntos(datos.fecha))}
          </td>
          <td style="width:33%;vertical-align:top;padding:0 10px;">
            ${garalCoverLabel(ampliacion ? "Incremento neto" : "Total actuación")}
            ${garalCoverValue(totalTxt)}
          </td>
          <td style="width:20%;vertical-align:top;padding-left:10px;">
            ${garalCoverLabel("Validez")}
            ${garalCoverValue(validez)}
          </td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;${hr}">
        <tr>
          ${bloques
            .map(
              (b, i) => `
            <td style="width:${colW};vertical-align:top;padding:14px ${i === bloques.length - 1 ? "0" : "12px"} 0 ${i === 0 ? "0" : "12px"};">
              ${garalCoverLabel(b.label)}
              ${garalCoverLines(b.lines)}
            </td>`
            )
            .join("")}
        </tr>
      </table>
    </div>
  `;
}

function medicionPageSizes(densidad: DensidadTabla) {
  return densidad === "compacta" ? { first: 13, next: 18 } : { first: 9, next: 13 };
}

function htmlFondoRejilla() {
  return `<div class="pdf-cover-bg" style="background:
         linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
         linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px),
         ${NAVY};
         background-size: 28px 28px, 28px 28px, auto;"></div>`;
}

function htmlFondoFoto(src: string) {
  return `<img data-pdf-img class="pdf-cover-bg" src=${JSON.stringify(src)} alt="" width="${PAGE_W_PX}" height="${PAGE_H_PX}" style="object-fit:cover; object-position:center top;" />
       <div style="position:absolute; left:0; top:0; width:${PAGE_W_PX}px; height:${PAGE_H_PX}px; background:linear-gradient(180deg, rgba(11,29,46,0.35) 0%, rgba(11,29,46,0.55) 48%, ${NAVY} 62%, ${NAVY} 100%);"></div>`;
}

function htmlPortada(ctx: PdfCtx, datos: PresupuestoPdfDatos) {
  const p = ctx.propuesta;
  const titulo = (datos.concepto || "Presupuesto").trim();
  const cabeceraCliente = hasAsset(ctx.cliente?.presupuesto_cabecera_url);
  const foto = p.foto_portada?.dataUrl?.startsWith("data:image/") ? p.foto_portada.dataUrl : "";
  let fondo = "";
  if (p.variante_portada === "rejilla") {
    fondo = htmlFondoRejilla();
  } else if (p.variante_portada === "foto" && foto) {
    fondo = htmlFondoFoto(foto);
  } else if (p.variante_portada === "auto" && foto && !ctx.esDeportivo) {
    fondo = htmlFondoFoto(foto);
  } else if (ctx.esDeportivo) {
    const src = absAsset(ctx.origin, ASSETS.fondoRiazor);
    fondo = `<img data-pdf-img class="pdf-cover-bg" src=${JSON.stringify(src)} alt="" width="${PAGE_W_PX}" height="${PAGE_H_PX}" />`;
  } else if (cabeceraCliente) {
    const src = resolveAssetUrl(ctx.cliente?.presupuesto_cabecera_url, ctx.origin);
    fondo = htmlFondoFoto(src);
  } else {
    fondo = htmlFondoRejilla();
  }

  return `
    <div class="pdf-page pdf-cover">
      ${fondo}
      ${htmlMarcoTecnico()}
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
            <div style="font-size:9px; letter-spacing:0.22em; text-transform:uppercase; white-space:nowrap;font-family:${GARAL_MONO};">${p.tipo === "ampliacion" ? "Ampliación técnica y económica" : "Propuesta técnica y económica"}</div>
          </div>
          <div style="font-size:36px; font-weight:700; line-height:1.12; letter-spacing:-0.02em; white-space:pre-wrap;">${htmlEsc(titulo)}</div>
          ${p.subtitulo_portada.trim() ? `<div style="margin-top:8px; font-size:22px; font-weight:600; line-height:1.2;">${htmlEsc(p.subtitulo_portada.trim())}</div>` : ""}
          ${p.descripcion_portada.trim() ? `<p style="margin:16px 0 0; max-width:92%; font-size:13px; line-height:1.5; font-family:${GARAL_MONO}; font-weight:400; opacity:0.92;">${htmlMultiline(p.descripcion_portada.trim())}</p>` : ""}
        </div>
        ${htmlPortadaPie(ctx, datos)}
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
      <td style="width:50%; vertical-align:top; padding:0 18px 22px 0;">
        <div style="border-left:2px solid #6A9BB0; padding-left:12px;">
          <div style="font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#6A9BB0; font-weight:700; margin-bottom:6px;">${htmlEsc(codigo)}</div>
          <div style="font-size:14px; font-weight:700; margin-bottom:4px;">${htmlEsc(z.titulo.trim() || "—")}</div>
          <div style="font-size:12px; line-height:1.45; color:#333;">${z.descripcion.trim() ? htmlMultiline(z.descripcion.trim()) : ""}</div>
        </div>
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

function pieMarca(ctx: PdfCtx) {
  if (ctx.esGaral) return "Garal · Diseño & obra";
  return "Rehabinco S.L. · Gestión inmobiliaria y reformas";
}

function htmlDatos(ctx: PdfCtx, datos: PresupuestoPdfDatos, page: number, total: number) {
  const cliente = ctx.cliente;
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
      ${cabeceraInterior(ctx, datos, hojaCorta(page))}
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
      ${
        p.mostrar_zonas
          ? `<h2 style="margin:0 0 14px; font-size:18px; font-weight:700;">3. Zonas de intervención</h2>${htmlZonas(p.zonas)}`
          : ""
      }
      </div>
      ${pieInterior(pieMarca(ctx), hojaTxt(page, total))}
    </div>
  `;
}

type MedRow = { html: string };

function medicionRows(datos: PresupuestoPdfDatos, densidad: DensidadTabla): MedRow[] {
  const groups = new Map<string, PresupuestoPdfLinea[]>();
  for (const l of datos.lineas) {
    if (esLineaRepercusion(l.capitulo)) continue;
    const key = l.capitulo?.trim() || "";
    const arr = groups.get(key) ?? [];
    arr.push(l);
    groups.set(key, arr);
  }

  let capOrden = 0;
  const rows: MedRow[] = [];
  for (const [capitulo, items] of groups) {
    capOrden += 1;
    if (capitulo) {
      rows.push({
        html: `
        <tr>
          <td colspan="6" style="padding:10px 8px 7px; background:#f3f3f3; font-size:9px; letter-spacing:0.16em; text-transform:uppercase; color:#555; font-weight:700;">
            ${htmlEsc(capitulo)}
          </td>
        </tr>`,
      });
    }
    items.forEach((l, idxEnCap) => {
      const cant = Number(l.cantidad);
      const precio = Number(l.precio_unitario);
      const importe = cant * precio;
      const cod = codigoPartida(capitulo, capOrden, idxEnCap + 1);
      const ud = (l.unidad || "ud").trim() || "ud";
      const pad = densidad === "compacta" ? "7px 8px 8px" : "11px 8px 12px";
      rows.push({
        html: `
        <tr>
          <td style="padding:${pad}; border-bottom:1px solid ${LINE}; font-size:12px; color:#888; white-space:nowrap; vertical-align:top;">${htmlEsc(cod)}</td>
          <td style="padding:${pad}; border-bottom:1px solid ${LINE}; font-size:12px; font-weight:700; line-height:1.4; vertical-align:top;">${htmlMultiline(l.descripcion)}</td>
          <td style="padding:${pad}; border-bottom:1px solid ${LINE}; font-size:11px; text-align:center; vertical-align:top; color:#444;">${htmlEsc(ud)}</td>
          <td style="padding:${pad}; border-bottom:1px solid ${LINE}; font-size:12px; text-align:right; vertical-align:top;">${formatNum(cant)}</td>
          <td style="padding:${pad}; border-bottom:1px solid ${LINE}; font-size:12px; text-align:right; vertical-align:top;">${formatNum(precio)}</td>
          <td style="padding:${pad}; border-bottom:1px solid ${LINE}; font-size:12px; text-align:right; font-weight:600; vertical-align:top;">${formatNum(importe)}</td>
        </tr>`,
      });
    });
  }
  return rows;
}

function chunkRows<T>(items: T[], firstMax: number, nextMax: number): T[][] {
  const pages: T[][] = [];
  let limit = firstMax;
  let cur: T[] = [];
  for (const item of items) {
    if (cur.length >= limit) {
      pages.push(cur);
      cur = [];
      limit = nextMax;
    }
    cur.push(item);
  }
  if (cur.length) pages.push(cur);
  if (pages.length === 0) pages.push([]);
  return pages;
}

function htmlTotalesMedicion(datos: PresupuestoPdfDatos) {
  const ivaPct = Number(datos.porcentaje_impuesto ?? 21) || 0;
  const descuento =
    Number(datos.porcentaje_descuento) > 0
      ? `<tr>
          <td style="padding:6px 0; color:#444;">Baja ofertada −${formatNum(Number(datos.porcentaje_descuento))} %</td>
          <td style="padding:6px 0; text-align:right;">− ${formatCurrency(Number(datos.importe_descuento))}</td>
        </tr>`
      : "";
  return `
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
      </table>`;
}

function htmlTablaPartidas(body: string, showHead: boolean) {
  const head = showHead
    ? `<thead>
          <tr style="background:#111; color:#fff;">
            <th style="padding:8px; text-align:left; font-size:8px; letter-spacing:0.12em; font-weight:600; width:52px;">CÓD.</th>
            <th style="padding:8px; text-align:left; font-size:8px; letter-spacing:0.12em; font-weight:600;">DESCRIPCIÓN DE LA PARTIDA</th>
            <th style="padding:8px; text-align:center; font-size:8px; letter-spacing:0.12em; font-weight:600; width:44px;">UD</th>
            <th style="padding:8px; text-align:right; font-size:8px; letter-spacing:0.12em; font-weight:600; width:64px;">CANT.</th>
            <th style="padding:8px; text-align:right; font-size:8px; letter-spacing:0.12em; font-weight:600; width:72px;">PRECIO</th>
            <th style="padding:8px; text-align:right; font-size:8px; letter-spacing:0.12em; font-weight:600; width:80px;">IMPORTE</th>
          </tr>
        </thead>`
    : "";
  return `<table style="width:100%; border-collapse:collapse; margin-bottom:18px;">${head}<tbody>${body}</tbody></table>`;
}

function htmlMedicionesPages(ctx: PdfCtx, datos: PresupuestoPdfDatos, startPage: number, total: number) {
  const { first, next } = medicionPageSizes(ctx.propuesta.densidad_tabla);
  const chunks = chunkRows(medicionRows(datos, ctx.propuesta.densidad_tabla), first, next);
  return chunks.map((chunk, i) => {
    const page = startPage + i;
    const isLast = i === chunks.length - 1;
    const title =
      i === 0
        ? `<h2 style="margin:0 0 14px; font-size:18px; font-weight:700;">4. Mediciones y presupuesto</h2>`
        : `<h2 style="margin:0 0 14px; font-size:16px; font-weight:700;">4. Mediciones y presupuesto <span style="font-weight:500; color:${MUTED};">(cont.)</span></h2>`;
    return `
    <div class="pdf-page">
      <div class="pdf-page-inner">
      ${cabeceraInterior(ctx, datos, hojaCorta(page))}
      ${title}
      ${htmlTablaPartidas(chunk.map((r) => r.html).join(""), true)}
      ${isLast ? htmlTotalesMedicion(datos) : ""}
      </div>
      ${pieInterior("Importes en euros · IVA no incluido en las partidas", hojaTxt(page, total))}
    </div>`;
  });
}

function htmlAnexosPages(ctx: PdfCtx, datos: PresupuestoPdfDatos, startPage: number, total: number) {
  const items = ctx.propuesta.adjuntos.filter((a) => a.dataUrl.startsWith("data:image/"));
  if (items.length === 0) return [];
  const pages: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const page = startPage + pages.length;
    const pair = items.slice(i, i + 2);
    const fotos = pair
      .map(
        (a) => `
        <div style="margin-bottom:16px;">
          <div style="border:1px solid ${LINE}; background:#f6f6f6; height:360px; overflow:hidden;">
            <img data-pdf-img src=${JSON.stringify(a.dataUrl)} alt="" style="width:100%; height:360px; object-fit:contain; display:block; border:0;" />
          </div>
          <div style="margin-top:6px; font-size:10px; letter-spacing:0.08em; text-transform:uppercase; color:${MUTED};">${htmlEsc(a.nombre)}</div>
        </div>`
      )
      .join("");
    pages.push(`
    <div class="pdf-page">
      <div class="pdf-page-inner">
      ${cabeceraInterior(ctx, datos, hojaCorta(page))}
      <h2 style="margin:0 0 14px; font-size:18px; font-weight:700;">Anexos</h2>
      ${fotos}
      </div>
      ${pieInterior(pieMarca(ctx), hojaTxt(page, total))}
    </div>`);
  }
  return pages;
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

function htmlCierre(ctx: PdfCtx, datos: PresupuestoPdfDatos, page: number, total: number) {
  const emisor = ctx.emisor;
  const p = ctx.propuesta;
  const lugar = emisor.localidad?.trim() || "A Coruña";
  const fechaLarga = formatFechaLarga(datos.fecha).toUpperCase();
  return `
    <div class="pdf-page">
      <div class="pdf-page-inner">
      ${cabeceraInterior(ctx, datos, hojaCorta(page))}
      ${p.mostrar_programa ? `<h2 style="margin:0 0 12px; font-size:18px; font-weight:700;">5. Programa de trabajos</h2>${htmlPrograma(p.programa)}` : ""}
      <h2 style="margin:0 0 12px; font-size:18px; font-weight:700;">${p.mostrar_programa ? "6. Condiciones y garantías" : "5. Condiciones y garantías"}</h2>
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
      ${pieInterior(`En ${lugar}, a ${fechaLarga}`, hojaTxt(page, total))}
    </div>
  `;
}

function htmlTotalesAnchos(ctx: PdfCtx, datos: PresupuestoPdfDatos) {
  const t = totAmpliacion(ctx, datos);
  const ivaPct = Number(datos.porcentaje_impuesto ?? 21) || 0;
  return `
      <table style="width:100%; max-width:440px; margin-left:auto; border-collapse:collapse; font-size:13px;">
        <tr>
          <td style="padding:8px 16px 8px 0; color:#444;">Incremento neto</td>
          <td style="padding:8px 0; text-align:right; white-space:nowrap;">${formatCurrency(t.incrementoNeto)}</td>
        </tr>
        <tr>
          <td style="padding:8px 16px 8px 0; color:#444;">IVA ${ivaPct} %</td>
          <td style="padding:8px 0; text-align:right; white-space:nowrap;">${formatCurrency(t.ivaIncremento)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:0; padding-top:8px;">
            <div style="background:#111; color:#fff; padding:12px 16px; font-weight:700; display:flex; justify-content:space-between; gap:16px; letter-spacing:0.08em; font-size:12px;">
              <span>TOTAL OFERTA</span>
              <span style="white-space:nowrap;">${formatCurrency(t.totalIncremento)}</span>
            </div>
          </td>
        </tr>
      </table>`;
}

function htmlRepercusion(ctx: PdfCtx, datos: PresupuestoPdfDatos) {
  const p = ctx.propuesta;
  if (!p.mostrar_repercusion) return "";
  const t = totAmpliacion(ctx, datos);
  const origen = p.origen_numero.trim() || "presupuesto inicial";
  const fila = (label: string, value: string, strong = false) => `
        <tr>
          <td style="padding:9px 12px; border-bottom:1px solid ${LINE}; font-size:13px;${strong ? " font-weight:700;" : " color:#444;"}">${label}</td>
          <td style="padding:9px 12px; border-bottom:1px solid ${LINE}; font-size:13px; text-align:right; white-space:nowrap;${strong ? " font-weight:700;" : ""}">${value}</td>
        </tr>`;
  const bajas = p.bajas
    .filter((b) => b.descripcion.trim() || b.importe > 0)
    .map((b) => fila(htmlEsc(b.descripcion || "Baja"), `− ${formatCurrency(b.importe)}`))
    .join("");
  const ajuste =
    t.ajuste !== 0
      ? fila(
          "Ajuste comercial para mantener la oferta inicial",
          `${t.ajuste < 0 ? "− " : "+ "}${formatCurrency(Math.abs(t.ajuste))}`
        )
      : "";
  return `
      <h2 style="margin:18px 0 10px; font-size:16px; font-weight:700;">Repercusión sobre el presupuesto inicial</h2>
      <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
        ${fila(`Presupuesto inicial ${htmlEsc(origen)} · oferta cerrada`, formatCurrency(p.origen_total))}
        ${bajas}
        ${fila("Alta de la nueva actuación", `+ ${formatCurrency(t.altas)}`)}
        ${ajuste}
        ${fila("Presupuesto resultante · IVA no incluido", formatCurrency(t.resultante), true)}
        ${fila(`IVA ${Number(datos.porcentaje_impuesto) || 0} %`, formatCurrency(t.ivaResultante))}
        ${fila("Total con IVA", formatCurrency(t.totalResultante), true)}
      </table>`;
}

function htmlAmpliacionInterior(ctx: PdfCtx, datos: PresupuestoPdfDatos, page: number, total: number) {
  const p = ctx.propuesta;
  const objeto =
    p.objeto_alcance.trim() ||
    datos.concepto?.trim() ||
    "Ampliación sobre el presupuesto inicial.";
  const body = medicionRows(datos, "compacta")
    .map((r) => r.html)
    .join("");
  const cond = p.condicionantes_ejecucion.trim() || "";
  const obs = p.mostrar_observaciones ? p.observaciones.trim() : "";
  return `
    <div class="pdf-page">
      <div class="pdf-page-inner">
      ${cabeceraInterior(ctx, datos, hojaCorta(page))}
      <h2 style="margin:0 0 10px; font-size:18px; font-weight:700;">1. Objeto</h2>
      <p style="margin:0 0 16px; font-size:13px; line-height:1.5; color:#222;">${htmlMultiline(objeto)}</p>
      <h2 style="margin:0 0 10px; font-size:18px; font-weight:700;">2. Desglose</h2>
      ${htmlTablaPartidas(body, true)}
      ${htmlTotalesAnchos(ctx, datos)}
      ${htmlRepercusion(ctx, datos)}
      ${
        cond
          ? `<h2 style="margin:16px 0 8px; font-size:16px; font-weight:700;">Condicionantes de ejecución</h2>
      <p style="margin:0 0 12px; font-size:13px; line-height:1.5; color:#222;">${htmlMultiline(cond)}</p>`
          : ""
      }
      ${
        obs
          ? `<h2 style="margin:12px 0 8px; font-size:16px; font-weight:700;">Observaciones</h2>
      <p style="margin:0; font-size:13px; line-height:1.5; color:#222;">${htmlMultiline(obs)}</p>`
          : ""
      }
      </div>
      ${pieInterior("Importes en euros · IVA no incluido en las partidas", hojaTxt(page, total))}
    </div>`;
}

function wrapPresupuestoHtml(numero: string, inner: string) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${htmlEsc(numero)}</title>
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
  const anexoCount = ctx.esGaral
    ? Math.ceil(ctx.propuesta.adjuntos.filter((a) => a.dataUrl.startsWith("data:image/")).length / 2)
    : 0;

  if (ctx.propuesta.tipo === "ampliacion") {
    const totalPages = 2 + anexoCount;
    const anexoHtml = ctx.esGaral ? htmlAnexosPages(ctx, params.datos, 3, totalPages).join("") : "";
    return wrapPresupuestoHtml(
      params.datos.numero,
      htmlPortada(ctx, params.datos) + htmlAmpliacionInterior(ctx, params.datos, 2, totalPages) + anexoHtml
    );
  }

  const densidad = ctx.propuesta.densidad_tabla;
  const { first, next } = medicionPageSizes(densidad);
  const medCount = chunkRows(medicionRows(params.datos, densidad), first, next).length;
  const totalPages = 2 + medCount + anexoCount + 1;
  let n = 2;
  const datosHtml = htmlDatos(ctx, params.datos, n, totalPages);
  n += 1;
  const medHtml = htmlMedicionesPages(ctx, params.datos, n, totalPages).join("");
  n += medCount;
  const anexoHtml = ctx.esGaral ? htmlAnexosPages(ctx, params.datos, n, totalPages).join("") : "";
  n += anexoCount;
  const inner =
    htmlPortada(ctx, params.datos) +
    datosHtml +
    medHtml +
    anexoHtml +
    htmlCierre(ctx, params.datos, n, totalPages);

  return wrapPresupuestoHtml(params.datos.numero, inner);
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
