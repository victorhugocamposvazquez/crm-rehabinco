import {
  ANIO_DOCUMENTO,
  EMPRESA_DOCUMENTOS,
  clausulaLopdCuerpo,
  clausulaLopdResponsable,
  formatFechaDocumento,
  formatHoraCorta,
  htmlEsc,
  pieContactoEmpresa,
} from "./empresa-documentos";
import { downloadPagedHtmlPdf, envolverDocumentoHtml, slugArchivo } from "./documentos-pdf";

export type CalidadVisita = "comprador" | "arrendatario";

export const CALIDAD_VISITA_LABEL: Record<CalidadVisita, string> = {
  comprador: "comprador",
  arrendatario: "arrendatario",
};

export type ParteVisitaPdfDatos = {
  visitante_nombre: string | null;
  visitante_documento: string | null;
  inmueble_direccion: string | null;
  fecha_visita: string | null;
  hora_visita: string | null;
  hora_fin: string | null;
  calidad: CalidadVisita | string | null;
  agente_nombre: string | null;
  lugar_firma?: string | null;
  firma_visitante?: string | null;
  firma_agente?: string | null;
};

export function horaMasUna(hora: string | null | undefined): string {
  if (!hora) return "";
  const [h, m] = hora.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(h)) return "";
  const total = (h * 60 + (Number.isFinite(m) ? m : 0) + 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function parseCalidadVisita(value: string | null | undefined): CalidadVisita {
  return value === "arrendatario" ? "arrendatario" : "comprador";
}

export function franjaHorariaVisita(
  hora: string | null | undefined,
  horaFin: string | null | undefined
): string {
  const ini = formatHoraCorta(hora);
  const fin = formatHoraCorta(horaFin);
  if (ini !== "—" && fin !== "—") return `Entre las ${ini} y las ${fin} horas`;
  if (ini !== "—") return `A las ${ini} horas`;
  return "Entre las ____ y las ____ horas";
}

export function lineaFechaVisita(datos: ParteVisitaPdfDatos): string {
  const lugar = datos.lugar_firma?.trim() || EMPRESA_DOCUMENTOS.lugar;
  const fecha = formatFechaDocumento(datos.fecha_visita, {
    mesMayuscula: true,
    vacio: `____ de ________ de ${ANIO_DOCUMENTO}`,
  });
  return `${franjaHorariaVisita(datos.hora_visita, datos.hora_fin)} en ${lugar} a ${fecha}`;
}

export function textoCuerpoParteVisita(datos: ParteVisitaPdfDatos): string {
  const e = EMPRESA_DOCUMENTOS;
  const nombre = datos.visitante_nombre?.trim() || "………………………………………………………………………";
  const dni = datos.visitante_documento?.trim() || "……………………………";
  const calidad = parseCalidadVisita(datos.calidad);
  const direccion = datos.inmueble_direccion?.trim() || "…………………………………………";
  const agente = datos.agente_nombre?.trim() || "……………………";
  const verbo = direccion.includes(",") || /\sy\s/i.test(direccion) ? "ha visitado las viviendas sitas en" : "ha visitado la vivienda sita en";
  const gestion = calidad === "arrendatario" ? "alquilar" : "comprar";
  return `D./Dña ${nombre} en calidad de ${calidad} y provisto de D.N.I/N.I.F ${dni} ${verbo} ${direccion}, acompañado del agente comercial ${agente}, miembro de ${e.razonSocial} con C.I.F. ${e.cif}.

Asimismo “El Cliente” manifiesta que se compromete a no realizar ninguna gestión encaminada a ${gestion} por sí mismo, por medio de apoderado, o por conducto de terceras personas familiares directos el inmueble visitado por mediación de ${e.razonSocial}.`;
}

export function htmlParteVisita(datos: ParteVisitaPdfDatos): string {
  const e = EMPRESA_DOCUMENTOS;
  const cuerpo = textoCuerpoParteVisita(datos).split("\n\n");
  const firmaVisitante = datos.firma_visitante
    ? `<img src="${htmlEsc(datos.firma_visitante)}" alt="Firma del interesado" style="height:72px;max-width:240px;object-fit:contain;" />`
    : `<div style="height:72px;"></div>`;
  const pie = pieContactoEmpresa().replace(/\n/g, "<br />");
  const body = `
    <div class="pdf-page" style="padding:52px 58px 40px;display:flex;flex-direction:column;">
      <h1 style="margin:0 0 18px;font-size:22px;font-weight:700;">Parte de visita</h1>
      <p style="margin:0 0 22px;font-size:13.5px;line-height:1.45;">${htmlEsc(lineaFechaVisita(datos))}</p>
      <p style="margin:0 0 16px;font-size:13.5px;line-height:1.55;text-align:justify;">${htmlEsc(cuerpo[0] ?? "")}</p>
      <p style="margin:0 0 28px;font-size:13.5px;line-height:1.55;text-align:justify;">${htmlEsc(cuerpo[1] ?? "")}</p>
      <div style="margin-top:8px;">
        <p style="margin:0 0 6px;font-size:13.5px;font-weight:700;">El Interesado</p>
        <p style="margin:0 0 4px;font-size:12px;color:#444;">Firma</p>
        <div style="border-bottom:1px solid #222;width:280px;min-height:76px;">${firmaVisitante}</div>
      </div>
      <div style="margin-top:auto;padding-top:28px;">
        <p style="margin:0 0 8px;font-size:8.5px;line-height:1.4;color:#333;">${htmlEsc(clausulaLopdResponsable())}</p>
        <p style="margin:0 0 14px;font-size:8.5px;line-height:1.4;color:#333;white-space:pre-wrap;">${htmlEsc(
          clausulaLopdCuerpo(
            "llevar a cabo un registro y control de las visitas realizadas a los inmuebles gestionados por la misma."
          )
        )}</p>
        <p style="margin:0;font-size:10px;line-height:1.45;color:#222;">${pie}</p>
      </div>
    </div>
  `;
  return envolverDocumentoHtml({ title: `Parte de visita · ${e.razonSocial}`, body });
}

export function parteVisitaPdfFilename(datos: ParteVisitaPdfDatos): string {
  const quien = slugArchivo(datos.visitante_nombre?.trim() || "", "visitante");
  const fecha = datos.fecha_visita?.slice(0, 10) || String(ANIO_DOCUMENTO);
  return `Parte-visita-${fecha}-${quien}.pdf`;
}

export async function downloadParteVisitaPdf(datos: ParteVisitaPdfDatos) {
  await downloadPagedHtmlPdf({
    html: htmlParteVisita(datos),
    filename: parteVisitaPdfFilename(datos),
  });
}
