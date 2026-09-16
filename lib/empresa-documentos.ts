/** Datos fijos de Rehabinco en partes de visita, arras y cláusulas LOPD. */
export const ANIO_DOCUMENTO = 2026;

export const EMPRESA_DOCUMENTOS = {
  razonSocial: "REHABINCO, S.L.",
  cif: "B22834005",
  direccion: "Rúa da Merced nº 57, Bajo",
  codigoPostal: "15009",
  localidad: "A Coruña",
  direccionCompleta: "Rúa da Merced nº 57, Bajo, 15009 A Coruña",
  telefono: "664 859 306",
  email: "oficina@rehabinco.com",
  web: "www.rehabinco.com",
  lugar: "A Coruña",
} as const;

export function htmlEsc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function htmlMultilinea(s: string) {
  return htmlEsc(s).replace(/\n/g, "<br />");
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export function parseFechaLocal(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatFechaDocumento(
  dateStr: string | null | undefined,
  opts?: { mesMayuscula?: boolean; vacio?: string }
): string {
  const d = parseFechaLocal(dateStr);
  if (!d) return opts?.vacio ?? `____ de ________ de ${ANIO_DOCUMENTO}`;
  const month = MESES[d.getMonth()];
  const mes = opts?.mesMayuscula ? month.charAt(0).toUpperCase() + month.slice(1) : month;
  return `${d.getDate()} de ${mes} de ${d.getFullYear()}`;
}

export function formatFechaEncabezado(
  dateStr: string | null | undefined,
  lugar: string = EMPRESA_DOCUMENTOS.lugar
): string {
  const d = parseFechaLocal(dateStr);
  if (!d) return `En ${lugar}, a ____ de ________ de ${ANIO_DOCUMENTO}`;
  return `En ${lugar}, a ${formatFechaDocumento(dateStr)}`;
}

export function formatHoraCorta(hora: string | null | undefined): string {
  if (!hora) return "—";
  return hora.slice(0, 5);
}

export function clausulaLopdResponsable(): string {
  const e = EMPRESA_DOCUMENTOS;
  return `Responsable: Identidad: ${e.razonSocial} CIF: ${e.cif} Dir. Postal: ${e.direccionCompleta} Teléfono: ${e.telefono} Correo electrónico: ${e.email}`;
}

export function clausulaLopdCuerpo(fin: string): string {
  return `En nombre de ${EMPRESA_DOCUMENTOS.razonSocial} tratamos la información que nos facilita con el fin de ${fin} Los datos proporcionados se conservarán mientras no solicite la cancelación de los mismos, o durante el tiempo necesario para cumplir con las obligaciones legales. Los datos no se cederán a terceros salvo en los casos en que exista una obligación legal, ni se elaborará ningún tipo de “perfil” en base a la información facilitada ni se tomarán decisiones automatizadas en base a perfiles.
Usted podrá ejercer los derechos de acceso, rectificación, cancelación, supresión, oposición, limitación del tratamiento, portabilidad de datos y a no ser objeto de decisiones individualizadas, automatizadas, en relación con los datos objeto del tratamiento, ante el responsable del tratamiento en la dirección anteriormente mencionada.
En caso de que no haya obtenido satisfacción en el ejercicio de sus derechos, puede presentar una reclamación ante la Autoridad de Control en materia de Protección de Datos competente.`;
}

export function pieContactoEmpresa(): string {
  const e = EMPRESA_DOCUMENTOS;
  return `(${e.direccion}, ${e.codigoPostal}\n${e.localidad}\nTeléfono ${e.telefono}\n${e.email}\n${e.web})`;
}
