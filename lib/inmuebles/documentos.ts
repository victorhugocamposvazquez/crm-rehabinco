export const TIPOS_DOCUMENTO_INMUEBLE = [
  "nota_simple",
  "certificado_energetico",
  "cedula",
  "escritura",
  "otro",
] as const;

export type TipoDocumentoInmueble = (typeof TIPOS_DOCUMENTO_INMUEBLE)[number];

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumentoInmueble, string> = {
  nota_simple: "Nota simple",
  certificado_energetico: "Certificado energético",
  cedula: "Cédula de habitabilidad",
  escritura: "Escritura",
  otro: "Otro",
};

export const BUCKET_DOCS_INMUEBLE = "inmueble-docs";
