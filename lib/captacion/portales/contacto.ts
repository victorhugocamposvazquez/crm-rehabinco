export type PlantillaWhatsapp = {
  id: string;
  nombre: string;
  texto: string;
};

export const PLANTILLAS_WHATSAPP: PlantillaWhatsapp[] = [
  {
    id: "presentacion",
    nombre: "Presentación",
    texto:
      "Hola {nombre}, soy {comercial} de Rehabinco. He visto tu anuncio en Idealista ({titulo}, {zona}) y me gustaría comentártelo. ¿Te viene bien una llamada?",
  },
  {
    id: "visita",
    nombre: "Proponer visita",
    texto: "Hola {nombre}, soy {comercial} de Rehabinco. ¿Podríamos ver {titulo} en {zona} esta semana?",
  },
  {
    id: "seguimiento",
    nombre: "Seguimiento",
    texto: "Hola {nombre}, te escribo de nuevo desde Rehabinco por {titulo}. ¿Sigues con la venta?",
  },
];

export type DatosMensajeCaptacion = {
  nombre?: string | null;
  comercial?: string | null;
  titulo?: string | null;
  zona?: string | null;
  municipio?: string | null;
};

export function rellenarPlantilla(texto: string, datos: DatosMensajeCaptacion): string {
  const nombre = datos.nombre?.trim() || "";
  const comercial = datos.comercial?.trim() || "Rehabinco";
  const titulo = datos.titulo?.trim() || "tu anuncio";
  const zona = [datos.zona, datos.municipio].map((v) => v?.trim()).filter(Boolean).join(", ") || "tu zona";
  return texto
    .replaceAll("{nombre}", nombre)
    .replaceAll("{comercial}", comercial)
    .replaceAll("{titulo}", titulo)
    .replaceAll("{zona}", zona)
    .replace(/\s+,/g, ",")
    .replace(/Hola ,/g, "Hola,")
    .replace(/\(\s*,/g, "(")
    .replace(/,\s*\)/g, ")")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Número para wa.me: con prefijo 34 y sin signos. */
export function telefonoWhatsapp(telefono: string): string {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.startsWith("34") && digitos.length >= 11) return digitos;
  if (digitos.length === 9) return `34${digitos}`;
  return digitos;
}

export function urlWhatsapp(telefono: string, mensaje: string): string {
  return `https://wa.me/${telefonoWhatsapp(telefono)}?text=${encodeURIComponent(mensaje)}`;
}

export function notasRecordatorioCaptacion(datos: {
  titulo: string;
  zona?: string | null;
  municipio?: string | null;
  precio?: string | null;
  telefono: string;
  nombre?: string | null;
  url?: string | null;
}): string {
  const donde = [datos.zona, datos.municipio].filter(Boolean).join(", ");
  return [
    "Captación",
    datos.titulo,
    donde,
    datos.precio,
    datos.nombre ? `Contacto: ${datos.nombre}` : null,
    `Tel. ${datos.telefono}`,
    datos.url,
  ]
    .filter(Boolean)
    .join("\n");
}
