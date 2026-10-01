import {
  EMPRESA_DOCUMENTOS,
  clausulaProteccionDatosContrato,
  formatFechaEncabezado,
  htmlEsc,
} from "./empresa-documentos";
import { formatImporteEs } from "./contrato-arras";
import { cssExportContratoArras, cssPreviewEditableArras } from "./contrato-arras-preview";
import { envolverFlujoDocumento } from "./documentos-paginacion";
import { envolverDocumentoHtml, slugArchivo } from "./documentos-pdf";
import type {
  ClausulaHonorariosKey,
  ClausulasPersonalizadasHonorarios,
  HojaEncargoHonorariosDatos,
} from "./hoja-encargo-honorarios";

function hueco(valor: string | null | undefined, fallback = "………………") {
  const t = valor?.trim();
  return t || fallback;
}

function aplicarPersonalizacion(
  key: ClausulaHonorariosKey,
  generado: string,
  personalizadas: ClausulasPersonalizadasHonorarios
): string {
  const custom = personalizadas[key]?.trim();
  return custom || generado;
}

function h(texto: string) {
  return `<p data-bloque="1" data-titulo-seccion="1" style="margin:18px 0 10px;font-size:13.5px;font-weight:700;letter-spacing:0.04em;">${htmlEsc(texto)}</p>`;
}

function bloqueEditable(key: ClausulaHonorariosKey, innerHtml: string, extraStyle = "") {
  return `<p data-bloque="1" data-clausula="${key}" contenteditable="true" style="margin:0 0 11px;font-size:13px;line-height:1.48;text-align:justify;${extraStyle}">${innerHtml}</p>`;
}

function bloqueEstatico(innerHtml: string, extraStyle = "") {
  return `<p data-bloque="1" style="margin:0 0 11px;font-size:13px;line-height:1.48;text-align:justify;${extraStyle}">${innerHtml}</p>`;
}

export function textosHojaEncargoHonorarios(datos: HojaEncargoHonorariosDatos) {
  const e = EMPRESA_DOCUMENTOS;
  const personalizadas = datos.clausulas_personalizadas ?? {};
  const pct = Number.isFinite(datos.honorarios_porcentaje) ? datos.honorarios_porcentaje : 3;
  const minimo = Number.isFinite(datos.honorarios_minimo) ? datos.honorarios_minimo : 3000;
  const prop = Number.isFinite(datos.reparto_propiedad_pct) ? datos.reparto_propiedad_pct : 60;
  const agencia = Number.isFinite(datos.reparto_agencia_pct) ? datos.reparto_agencia_pct : 40;
  const generados = {
    encabezado: formatFechaEncabezado(datos.fecha, datos.lugar.trim() || e.lugar),
    intro: `D./Dña. ${hueco(datos.cliente_nombre)}, con DNI ${hueco(datos.cliente_dni)}, mayor de edad, en calidad de ${hueco(datos.cliente_calidad, "propietario/a")}, firma con ${e.razonSocial}, con C.I.F. ${e.cif} y domicilio social en ${e.direccionCompleta}, la presente hoja de ENCARGO DE VENTA como un reconocimiento de honorarios en caso de acuerdo por la compraventa del piso/finca/propiedad situado en ${hueco(datos.inmueble_descripcion)}, conforme a las siguientes condiciones:`,
    honorarios: `Los honorarios de mediación de ${e.razonSocial} quedan fijados en un ${pct} % del precio de venta (IVA no incluido), con una retribución mínima de ${formatImporteEs(minimo)} € (IVA no incluido), que se devengarán íntegramente.`,
    reparto: `Si por medio de la gestión de la inmobiliaria se firmase un contrato de arras por una operación que finalmente no se llegase a escriturar, la cantidad entregada como depósito se repartirá entre inmobiliaria y propiedad a un ${prop} % para la propiedad y un ${agencia} % para la agencia inmobiliaria.`,
    lopd: clausulaProteccionDatosContrato(),
    cierre:
      "Y en prueba de conformidad, firman el presente documento por duplicado y a un solo efecto en el lugar y fecha del encabezamiento.",
  } satisfies Record<ClausulaHonorariosKey, string>;

  const textos = {} as Record<ClausulaHonorariosKey, string>;
  for (const key of Object.keys(generados) as ClausulaHonorariosKey[]) {
    textos[key] = aplicarPersonalizacion(key, generados[key], personalizadas);
  }
  return textos;
}

export function htmlHojaEncargoHonorarios(
  datos: HojaEncargoHonorariosDatos,
  opts?: { editable?: boolean }
): string {
  const t = textosHojaEncargoHonorarios(datos);
  const editable = opts?.editable !== false;
  const nombre = hueco(datos.cliente_nombre);
  const render = (s: string) => {
    let html = htmlEsc(s).replace(/\n/g, "<br />");
    if (nombre && nombre !== "………………") {
      const esc = htmlEsc(nombre);
      html = html.split(esc).join(`<strong>${esc}</strong>`);
    }
    return html;
  };
  const clausula = (key: ClausulaHonorariosKey, inner: string, extra = "") =>
    editable ? bloqueEditable(key, inner, extra) : bloqueEstatico(inner, extra);

  const bloques =
    clausula("encabezado", render(t.encabezado), "text-align:center;margin-bottom:22px;font-size:13.5px;") +
    h("HOJA DE ENCARGO PROFESIONAL") +
    `<p data-bloque="1" style="margin:0 0 14px;font-size:12.5px;text-align:center;color:#444;">Reconocimiento de honorarios · Encargo de venta</p>` +
    clausula("intro", render(t.intro)) +
    h("HONORARIOS") +
    clausula("honorarios", render(t.honorarios)) +
    clausula("reparto", render(t.reparto)) +
    h("PROTECCIÓN DE DATOS") +
    clausula("lopd", render(t.lopd)) +
    clausula("cierre", render(t.cierre), "margin-top:18px;") +
    `<div data-bloque="1" data-evitar-corte="1" class="pdf-firmas" style="margin-top:36px;display:flex;justify-content:space-between;gap:40px;">
        <div style="flex:1;text-align:center;">
          <p style="margin:0 0 64px;font-size:13px;font-weight:700;letter-spacing:0.04em;">FDO.: EL CLIENTE</p>
          <div style="border-top:1px solid #222;"></div>
        </div>
        <div style="flex:1;text-align:center;">
          <p style="margin:0 0 64px;font-size:13px;font-weight:700;letter-spacing:0.04em;">FDO.: LA AGENCIA</p>
          <div style="border-top:1px solid #222;"></div>
        </div>
      </div>`;

  const body = envolverFlujoDocumento(bloques);
  const extraCss = editable ? cssPreviewEditableArras() : cssExportContratoArras();
  return envolverDocumentoHtml({
    title: `Hoja de encargo · ${EMPRESA_DOCUMENTOS.razonSocial}`,
    body,
    serif: true,
    extraCss,
  });
}

export function htmlHojaEncargoHonorariosExport(datos: HojaEncargoHonorariosDatos): string {
  return htmlHojaEncargoHonorarios(datos, { editable: false });
}

export function hojaEncargoHonorariosPdfFilename(datos: HojaEncargoHonorariosDatos): string {
  const quien = slugArchivo(datos.cliente_nombre || "", "honorarios");
  const fecha = datos.fecha?.slice(0, 10) || String(new Date().getFullYear());
  return `Hoja-encargo-${fecha}-${quien}.pdf`;
}

export async function downloadHojaEncargoHonorariosPdf(datos: HojaEncargoHonorariosDatos) {
  const { prepararDocumentoExportHtml } = await import("./documentos-paginacion");
  const { downloadPagedHtmlPdf } = await import("./documentos-pdf");
  const html = await prepararDocumentoExportHtml(htmlHojaEncargoHonorariosExport(datos));
  await downloadPagedHtmlPdf({
    html,
    filename: hojaEncargoHonorariosPdfFilename(datos),
    ajustarAltura: true,
  });
}
