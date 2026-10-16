/** Datos fijos de Rehabinco en partes de visita, arras y cláusulas LOPD. */
export const ANIO_DOCUMENTO = 2026;

export const EMPRESA_DOCUMENTOS = {
  razonSocial: "REHABINCO, S.L.",
  cif: "B22834005",
  direccion: "Rúa da Merced nº 57, Bajo",
  codigoPostal: "15009",
  localidad: "A Coruña",
  direccionCompleta: "Rúa da Merced nº 57, Bajo, 15009 A Coruña",
  telefono: "664 85 93 06",
  email: "info@rehabinco.es",
  web: "www.rehabinco.com",
  lugar: "A Coruña",
} as const;

/** CIF, dominio y razón social de Conchado Puente. No el apellido suelto (p. ej. Adrián Conchado). */
const RE_DATOS_CONCHADO = /conchadopuente|b70101449|conchado\s+puente/i;

export function textoTieneDatosConchado(texto: string | null | undefined): boolean {
  return RE_DATOS_CONCHADO.test(texto ?? "");
}

/** Sustituye identificadores de Conchado Puente por los de Rehabinco. */
export function sanitizarTextoMarcaConchado(texto: string): string {
  if (!textoTieneDatosConchado(texto)) return texto;
  const e = EMPRESA_DOCUMENTOS;
  return texto
    .replace(/[\w.+-]+@conchadopuente\.com/gi, e.email)
    .replace(/conchadopuente\.com/gi, "rehabinco.com")
    .replace(/\bB70101449\b/gi, e.cif)
    .replace(/conchado\s+puente(?:\s*,?\s*s\.?\s*l\.?)?/gi, e.razonSocial)
    .replace(/conchadopuente/gi, e.razonSocial);
}

export function omitirClausulasConchado<K extends string>(
  clausulas: Partial<Record<K, string>> | null | undefined
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  if (!clausulas) return out;
  for (const [k, v] of Object.entries(clausulas) as Array<[K, string | undefined]>) {
    if (typeof v === "string" && v.trim() && !textoTieneDatosConchado(v)) out[k] = v;
  }
  return out;
}

export function aplicarClausulaPersonalizada<K extends string>(
  key: K,
  generado: string,
  personalizadas: Partial<Record<K, string>>
): string {
  const custom = personalizadas[key]?.trim();
  if (!custom || textoTieneDatosConchado(custom)) return sanitizarTextoMarcaConchado(generado);
  return sanitizarTextoMarcaConchado(custom);
}

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

/** Cláusula completa de protección de datos (misma redacción que el contrato de arras). */
export function clausulaProteccionDatosContrato(opts?: { prefijo?: string }): string {
  const e = EMPRESA_DOCUMENTOS;
  const prefijo = opts?.prefijo?.trim() ? `${opts.prefijo.trim()} ` : "";
  return `${prefijo}PROTECCIÓN DE DATOS. Responsable: ${e.razonSocial} CIF: ${e.cif}. Dirección: ${e.direccionCompleta}. Teléfono ${e.telefono}. Correo electrónico: ${e.email}.

De conformidad con lo establecido en la normativa vigente en materia de protección de datos de carácter personal, los datos y documentos facilitados por usted son necesarios para un correcto asesoramiento y mediación inmobiliaria. Dichos datos de carácter personal serán tratados por ${e.razonSocial} con la debida discreción y confidencialidad con el fin de llevar a cabo dicha gestión inmobiliaria.

Los datos proporcionados se conservarán durante el tiempo necesario para la finalidad en base a la cual han sido recabados, o para el cumplimiento con las obligaciones legales.

${e.razonSocial} no elaborará ningún tipo de “perfil” en base a la información facilitada. No se tomarán decisiones automatizadas en base a perfiles.

Igualmente, podrá ejercer los derechos de acceso, rectificación, cancelación, supresión, oposición, limitación del tratamiento, portabilidad de datos y a no ser objeto de decisiones individualizadas, automatizadas, en relación con los datos objeto del tratamiento, ante el responsable del tratamiento a la dirección arriba indicada.

En caso de que no haya obtenido satisfacción en el ejercicio de sus derechos, puede presentar una reclamación ante la Autoridad de Control en materia de Protección de Datos competente.`;
}

export function pieContactoEmpresa(): string {
  const e = EMPRESA_DOCUMENTOS;
  return `(${e.direccion}, ${e.codigoPostal}\n${e.localidad}\nTeléfono ${e.telefono}\n${e.email}\n${e.web})`;
}
