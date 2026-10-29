import {
  EMPRESA_DOCUMENTOS,
  aplicarClausulaPersonalizada,
  clausulaProteccionDatosContrato,
  formatFechaEncabezado,
  htmlEsc,
} from "./empresa-documentos";
import { formatImporteEs } from "./contrato-arras";
import { cssExportContratoArras, cssPreviewEditableArras } from "./contrato-arras-preview";
import { envolverFlujoDocumento } from "./documentos-paginacion";
import { envolverDocumentoHtml, slugArchivo } from "./documentos-pdf";
import type {
  ClausulaExclusivaKey,
  ClausulasPersonalizadasExclusiva,
  HojaEncargoExclusivaDatos,
} from "./hoja-encargo-exclusiva";

const LOGO_REHABINCO = "/images/logo-web.png";
const LOGO_ANCHO = 200;
const LOGO_ALTO = 46;

function srcLogoRehabinco(): string {
  if (typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null") {
    return `${window.location.origin}${LOGO_REHABINCO}`;
  }
  return LOGO_REHABINCO;
}

function marcaRehabinco(): string {
  return `<div data-bloque="1" data-evitar-corte="1" style="display:flex;justify-content:center;margin:0;padding:0 0 6px;">
    <img src="${srcLogoRehabinco()}" alt="Rehabinco" width="${LOGO_ANCHO}" height="${LOGO_ALTO}" style="width:${LOGO_ANCHO}px;height:${LOGO_ALTO}px;object-fit:contain;display:block;" />
  </div>`;
}

function hueco(valor: string | null | undefined, fallback = "………………") {
  const t = valor?.trim();
  return t || fallback;
}

function aplicarPersonalizacion(
  key: ClausulaExclusivaKey,
  generado: string,
  personalizadas: ClausulasPersonalizadasExclusiva
): string {
  return aplicarClausulaPersonalizada(key, generado, personalizadas);
}

function h(texto: string, extraStyle = "") {
  return `<p data-bloque="1" data-titulo-seccion="1" style="margin:12px 0 0;padding:0 0 4px;font-size:18px;font-weight:700;letter-spacing:0.04em;${extraStyle}">${htmlEsc(texto)}</p>`;
}

function bloqueEditable(key: ClausulaExclusivaKey, innerHtml: string, extraStyle = "") {
  return `<p data-bloque="1" data-clausula="${key}" contenteditable="true" style="margin:0;padding:0 0 8px;font-size:17px;line-height:1.64;text-align:justify;${extraStyle}">${innerHtml}</p>`;
}

function bloqueEstatico(innerHtml: string, extraStyle = "") {
  return `<p data-bloque="1" style="margin:0;padding:0 0 8px;font-size:17px;line-height:1.64;text-align:justify;${extraStyle}">${innerHtml}</p>`;
}

function textoPrecioVenta(precio: number | null): string {
  if (precio != null && Number.isFinite(precio) && precio > 0) {
    return `${formatImporteEs(precio)} €`;
  }
  return "……………… €";
}

export function textosHojaEncargoExclusiva(datos: HojaEncargoExclusivaDatos) {
  const e = EMPRESA_DOCUMENTOS;
  const personalizadas = datos.clausulas_personalizadas ?? {};
  const pct = Number.isFinite(datos.honorarios_porcentaje) ? datos.honorarios_porcentaje : 3;
  const minimo = Number.isFinite(datos.honorarios_minimo) ? datos.honorarios_minimo : 3000;
  const plazo = Number.isFinite(datos.plazo_meses) && datos.plazo_meses > 0 ? datos.plazo_meses : 6;
  const prop = Number.isFinite(datos.reparto_propiedad_pct) ? datos.reparto_propiedad_pct : 60;
  const agencia = Number.isFinite(datos.reparto_agencia_pct) ? datos.reparto_agencia_pct : 40;
  const generados = {
    encabezado: formatFechaEncabezado(datos.fecha, datos.lugar.trim() || e.lugar),
    intro: `D./Dña. ${hueco(datos.cliente_nombre)}, con DNI ${hueco(datos.cliente_dni)}, mayor de edad, en calidad de ${hueco(datos.cliente_calidad, "propietario/a")}, firma con ${e.razonSocial}, con C.I.F. ${e.cif} y domicilio social en ${e.direccionCompleta}, la presente hoja de ENCARGO DE VENTA EN EXCLUSIVA para la mediación en la compraventa del piso/finca/propiedad situado en ${hueco(datos.inmueble_descripcion)}, conforme a las siguientes condiciones:`,
    exclusiva: `El/la propietario/a otorga a ${e.razonSocial} el encargo de mediación en exclusiva para la venta del inmueble durante un plazo de ${plazo} meses contados desde la fecha del encabezamiento. Durante dicho plazo, ${e.razonSocial} será la única agencia autorizada para mediar en la venta; el/la propietario/a se compromete a no encargar la intermediación a otras agencias ni a publicar el inmueble por su cuenta en competencia con la agencia. Autoriza expresamente a ${e.razonSocial} a realizar publicidad, fotografías, visitas y cuantas gestiones sean necesarias para la comercialización.`,
    honorarios: `Los honorarios de mediación de ${e.razonSocial} quedan fijados en un ${pct} % del precio de venta (IVA no incluido), con una retribución mínima de ${formatImporteEs(minimo)} € (IVA no incluido), que se devengarán íntegramente si se produce la venta del inmueble durante la vigencia de la exclusiva, con independencia de que la operación se realice a través de ${e.razonSocial}, por el propio propietario o por un tercero.`,
    precio: `El precio de venta de encargo del inmueble queda fijado en ${textoPrecioVenta(datos.precio_venta)} (IVA no incluido, si procediera). Cualquier variación del precio de oferta se comunicará por escrito a la agencia.`,
    reparto: `Si por medio de la gestión de la inmobiliaria se firmase un contrato de arras por una operación que finalmente no se llegase a escriturar, la cantidad entregada como depósito se repartirá entre inmobiliaria y propiedad a un ${prop} % para la propiedad y un ${agencia} % para la agencia inmobiliaria.`,
    lopd: clausulaProteccionDatosContrato(),
    cierre:
      "Y en prueba de conformidad, firman el presente documento por duplicado y a un solo efecto en el lugar y fecha del encabezamiento.",
  } satisfies Record<ClausulaExclusivaKey, string>;

  const textos = {} as Record<ClausulaExclusivaKey, string>;
  for (const key of Object.keys(generados) as ClausulaExclusivaKey[]) {
    textos[key] = aplicarPersonalizacion(key, generados[key], personalizadas);
  }
  return textos;
}

export function htmlHojaEncargoExclusiva(
  datos: HojaEncargoExclusivaDatos,
  opts?: { editable?: boolean }
): string {
  const t = textosHojaEncargoExclusiva(datos);
  const editable = opts?.editable !== false;
  const nombre = hueco(datos.cliente_nombre);
  const render = (s: string) => {
    let html = htmlEsc(s).replace(/\n\n/g, '<span style="display:block;height:6px"></span>').replace(/\n/g, "<br />");
    if (nombre && nombre !== "………………") {
      const esc = htmlEsc(nombre);
      html = html.split(esc).join(`<strong>${esc}</strong>`);
    }
    return html;
  };
  const clausula = (key: ClausulaExclusivaKey, inner: string, extra = "") =>
    editable ? bloqueEditable(key, inner, extra) : bloqueEstatico(inner, extra);

  const bloques =
    marcaRehabinco() +
    clausula("encabezado", render(t.encabezado), "text-align:center;margin:0;padding:0 0 6px;font-size:17px;") +
    h("HOJA DE ENCARGO PROFESIONAL") +
    `<p data-bloque="1" style="margin:0;padding:0 0 8px;font-size:15.5px;text-align:center;color:#444;">Encargo de venta en exclusiva</p>` +
    clausula("intro", render(t.intro)) +
    h("EXCLUSIVA") +
    clausula("exclusiva", render(t.exclusiva)) +
    h("HONORARIOS") +
    clausula("honorarios", render(t.honorarios)) +
    h("PRECIO") +
    clausula("precio", render(t.precio)) +
    clausula("reparto", render(t.reparto)) +
    h("PROTECCIÓN DE DATOS", "font-size:11px;margin-top:10px;padding-bottom:2px;") +
    clausula("lopd", render(t.lopd), "font-size:10px;line-height:1.42;color:#333;padding-bottom:4px;") +
    clausula("cierre", render(t.cierre), "margin-top:10px;padding-bottom:2px;") +
    `<div data-bloque="1" data-evitar-corte="1" class="pdf-firmas" style="margin-top:16px;display:flex;justify-content:space-between;gap:40px;">
        <div style="flex:1;text-align:center;">
          <p style="margin:0 0 68px;font-size:16px;font-weight:700;letter-spacing:0.04em;">FDO.: EL CLIENTE</p>
          <div style="border-top:1px solid #222;"></div>
        </div>
        <div style="flex:1;text-align:center;">
          <p style="margin:0 0 68px;font-size:16px;font-weight:700;letter-spacing:0.04em;">FDO.: LA AGENCIA</p>
          <div style="border-top:1px solid #222;"></div>
        </div>
      </div>`;

  const body = envolverFlujoDocumento(bloques);
  const extraCss = editable ? cssPreviewEditableArras() : cssExportContratoArras();
  return envolverDocumentoHtml({
    title: `Encargo en exclusiva · ${EMPRESA_DOCUMENTOS.razonSocial}`,
    body,
    serif: true,
    extraCss,
  });
}

export function htmlHojaEncargoExclusivaExport(datos: HojaEncargoExclusivaDatos): string {
  return htmlHojaEncargoExclusiva(datos, { editable: false });
}

export function hojaEncargoExclusivaPdfFilename(datos: HojaEncargoExclusivaDatos): string {
  const quien = slugArchivo(datos.cliente_nombre || "", "exclusiva");
  const fecha = datos.fecha?.slice(0, 10) || String(new Date().getFullYear());
  return `Encargo-exclusiva-${fecha}-${quien}.pdf`;
}

export async function downloadHojaEncargoExclusivaPdf(datos: HojaEncargoExclusivaDatos) {
  const { prepararDocumentoExportHtml } = await import("./documentos-paginacion");
  const { downloadPagedHtmlPdf } = await import("./documentos-pdf");
  const html = await prepararDocumentoExportHtml(htmlHojaEncargoExclusivaExport(datos));
  await downloadPagedHtmlPdf({
    html,
    filename: hojaEncargoExclusivaPdfFilename(datos),
    ajustarAltura: true,
  });
}
