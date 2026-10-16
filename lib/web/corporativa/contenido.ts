/** Textos e imágenes del handoff design_handoff_rehabinco_web (sin depender del CRM). */

export const A = "/web/assets";

export const QUIENES_FILL =
  "Una inmobiliaria de A Coruña que también reforma. Compramos, vendemos y alquilamos pisos y, cuando hace falta, los rehabilitamos con nuestro propio equipo de obra.";

export const HUMAN_FILL =
  "Aunque nos encanta la innovación y la digitalización, tu propiedad siempre será tratada";

export const VENTAJAS: Array<[string, string]> = [
  ["Profesionales con experiencia", "Te acompañamos en cada etapa del proceso, ocupándonos de cada detalle para que no tengas que preocuparte por nada."],
  ["Acceso a los mejores inmuebles", "Una amplia cartera de viviendas, locales y edificios en A Coruña, la costa gallega y Mallorca."],
  ["Asesoramiento legal y financiero", "Preparamos y gestionamos toda la documentación para que cada operación sea rápida y segura."],
  ["También somos inversores", "Entendemos el mercado desde dentro y te ofrecemos oportunidades reales, sólidas y con visión de futuro."],
  ["Reformas con equipo propio", "Arquitectos, diseñadores y equipo de obra para revalorizar tu inmueble con presupuesto cerrado."],
  ["Servicio postventa", "Seguimos a tu lado después de la firma, con apoyo y soluciones cuando las necesites."],
];

export type ServicioDetalle = {
  titulo: string;
  resumen: string;
  img: string;
  lead: string;
  incluye: string[];
  stats: Array<[string, string]>;
};

export const SERVICIOS_RESUMEN: Array<[string, string]> = [
  ["Valoración gratuita", "Analizamos ubicación, estado, entorno y tendencias para darte un precio realista, sin compromiso."],
  ["Venta de inmuebles", "Promoción, visitas y negociación hasta la firma ante notario, con total transparencia."],
  ["Alquiler garantizado", "Buscamos el inquilino adecuado y protegemos cada contrato. Tú disfrutas de la rentabilidad."],
  ["Personal shopper inmobiliario", "Si buscas vivienda o inversión, lo hacemos por ti y negociamos pensando en tus intereses."],
  ["Financiación", "Comparamos entidades para conseguir la hipoteca más ventajosa según tu perfil."],
  ["Certificados", "Cédulas de habitabilidad, certificados energéticos e inspecciones técnicas de edificios."],
  ["Interiorismo y reformas", "Arquitectos y diseñadores que transforman espacios para sacar su mejor versión."],
  ["Selección de comprador", "Calidad frente a cantidad: compradores con solvencia real y visitas efectivas."],
];

export const SERVICIOS_DETALLE: ServicioDetalle[] = [
  {
    titulo: "Valoración gratuita",
    resumen: SERVICIOS_RESUMEN[0]![1],
    img: `${A}/aerea.jpg`,
    lead: "Conocemos el mercado a fondo y valoramos tu propiedad sin compromiso, con datos reales y no con promesas.",
    incluye: [
      "Visita al inmueble y análisis de estado, ubicación y entorno",
      "Estudio de comparables vendidos recientemente en tu zona",
      "Informe por escrito con precio recomendado de salida",
      "Recomendaciones para mejorar el valor antes de vender",
    ],
    stats: [
      ["48 h", "Informe por escrito"],
      ["0 €", "Sin compromiso"],
    ],
  },
  {
    titulo: "Venta de inmuebles",
    resumen: SERVICIOS_RESUMEN[1]![1],
    img: `${A}/edificio-dia.jpg`,
    lead: "Nos encargamos de todo el proceso de venta, desde la promoción y las visitas hasta la firma ante notario.",
    incluye: [
      "Reportaje fotográfico profesional y plano",
      "Difusión en portales nacionales e internacionales",
      "Gestión de visitas y negociación de ofertas",
      "Contrato de arras y acompañamiento en notaría",
    ],
    stats: [
      ["1", "Interlocutor único"],
      ["100 %", "Transparencia"],
    ],
  },
  {
    titulo: "Alquiler garantizado",
    resumen: SERVICIOS_RESUMEN[2]![1],
    img: `${A}/dormitorio-2.jpg`,
    lead: "Buscamos el inquilino adecuado según tus expectativas y aseguramos la máxima protección en cada contrato.",
    incluye: [
      "Estudio de solvencia de cada candidato",
      "Contrato redactado y revisado por nuestro equipo",
      "Seguro de impago y defensa jurídica",
      "Gestión de incidencias durante el alquiler",
    ],
    stats: [
      ["12 m", "Renta protegida"],
      ["24 h", "Respuesta a incidencias"],
    ],
  },
  {
    titulo: "Personal shopper inmobiliario",
    resumen: SERVICIOS_RESUMEN[3]![1],
    img: `${A}/terraza.jpg`,
    lead: "Si buscas vivienda o inversión, lo hacemos por ti: seleccionamos las mejores opciones y negociamos en tu interés.",
    incluye: [
      "Entrevista para definir lo que buscas y tu presupuesto",
      "Búsqueda dentro y fuera del mercado publicado",
      "Visitas preseleccionadas y análisis de cada opción",
      "Negociación del precio y condiciones",
    ],
    stats: [
      ["+40", "Inmuebles analizados"],
      ["1", "Asesor dedicado"],
    ],
  },
  {
    titulo: "Financiación",
    resumen: SERVICIOS_RESUMEN[4]![1],
    img: `${A}/salon.jpg`,
    lead: "Te ayudamos a encontrar la mejor solución financiera comparando entre entidades según tu perfil.",
    incluye: [
      "Estudio de tu capacidad de financiación",
      "Comparativa de ofertas de varias entidades",
      "Negociación de tipo, plazo y vinculaciones",
      "Acompañamiento hasta la firma de la hipoteca",
    ],
    stats: [
      ["+8", "Entidades comparadas"],
      ["0 €", "Primer estudio"],
    ],
  },
  {
    titulo: "Certificados",
    resumen: SERVICIOS_RESUMEN[5]![1],
    img: `${A}/obra-3.jpg`,
    lead: "Nos ocupamos de todos los documentos técnicos que necesita tu inmueble para vender, alquilar o reformar.",
    incluye: [
      "Certificado de eficiencia energética",
      "Cédula de habitabilidad",
      "Inspección técnica de edificios (ITE)",
      "Estudios energéticos y propuestas de mejora",
    ],
    stats: [
      ["5 días", "Plazo medio"],
      ["Técnicos", "Colegiados"],
    ],
  },
  {
    titulo: "Interiorismo y reformas",
    resumen: SERVICIOS_RESUMEN[6]![1],
    img: `${A}/cocina.jpg`,
    lead: "Transformamos espacios para sacar su mejor versión. Arquitectos y diseñadores te asesoran en cada paso.",
    incluye: [
      "Proyecto de interiorismo y distribución",
      "Presupuesto cerrado por escrito",
      "Obra con equipo propio y un único jefe de obra",
      "Entrega llave en mano con fecha en contrato",
    ],
    stats: [
      ["8–14 sem", "Reforma integral"],
      ["Cerrado", "Presupuesto"],
    ],
  },
  {
    titulo: "Selección de comprador",
    resumen: SERVICIOS_RESUMEN[7]![1],
    img: `${A}/jardin.jpg`,
    lead: "Priorizamos la calidad frente a la cantidad: compradores con solvencia real y visitas que de verdad cuentan.",
    incluye: [
      "Filtrado previo de cada interesado",
      "Verificación de financiación antes de visitar",
      "Visitas acompañadas y feedback tras cada una",
      "Informe semanal del estado de la venta",
    ],
    stats: [
      ["100 %", "Visitas filtradas"],
      ["Semanal", "Informe de venta"],
    ],
  },
];

export type PilarConfianza = {
  gancho: string;
  titulo: string;
  texto: string;
  img?: string;
};

export const DIFERENCIA_LEAD = "Menos intermediarios, más claridad en cada paso.";

export const PILARES_CONFIANZA: PilarConfianza[] = [
  {
    gancho: "De la primera visita a las llaves",
    titulo: "Un solo interlocutor",
    texto: "Compraventa, financiación, reforma y trámites con el mismo equipo. Sin cambiar de teléfono a mitad del camino.",
    img: `${A}/obra-3.jpg`,
  },
  {
    gancho: "Presupuesto cerrado por escrito",
    titulo: "Reformas sin sorpresas",
    texto: "Obra con equipo propio, partidas claras y fecha de entrega en el contrato.",
  },
  {
    gancho: "Sabes con quién hablas",
    titulo: "Transparencia",
    texto: "Los honorarios los asume el vendedor; para quien compra, la asesoría y las visitas son gratuitas.",
  },
  {
    gancho: "Postventa de verdad",
    titulo: "Seguimos después",
    texto: "Te acompañamos tras la firma con apoyo y soluciones cuando las necesitas.",
  },
];

export const REFORMAS = [
  { titulo: "Cocinas a medida", texto: "Diseño, mobiliario y encimeras de piedra natural. Instalación completa en tres semanas.", img: `${A}/cocina.jpg` },
  { titulo: "Baños en piedra y latón", texto: "Travertino, platos a ras de suelo y grifería empotrada. Impermeabilización garantizada.", img: `${A}/bano.jpg` },
  { titulo: "Suelos y carpintería de roble", texto: "Tarima de roble natural, puertas lacadas y armarios empotrados hasta el techo.", img: `${A}/dormitorio.jpg` },
  { titulo: "Reforma integral llave en mano", texto: "Distribución, instalaciones, aislamiento y acabados. Entregamos el piso listo para vivir.", img: `${A}/dormitorio-2.jpg` },
  { titulo: "Instalaciones completas", texto: "Fontanería, electricidad, climatización y saneamiento. Todo al día de la normativa y coordinado con el resto de la obra.", img: `${A}/obra-1.jpg` },
  { titulo: "Ventanas y aislamiento", texto: "Carpintería exterior, doble acristalamiento y soluciones térmicas y acústicas para ganar confort y eficiencia.", img: `${A}/obra-2.jpg` },
  { titulo: "Iluminación y pintura", texto: "Proyecto de luz, pintura al agua, revestimientos y el detalle de acabado en cada estancia.", img: `${A}/salon.jpg` },
  { titulo: "Terrazas y exteriores", texto: "Suelos técnicos, barandillas, impermeabilización y acondicionamiento de porches y terrazas.", img: `${A}/terraza.jpg` },
];

export const REFORMAS_CIERRA = "Y mucho más...";

export const FASES_360 = [
  ["Búsqueda o valoración", "Personal shopper o precio realista para vender", "Incluido"],
  ["Financiación", "Comparamos entidades y negociamos tu hipoteca", "Incluido"],
  ["Compraventa", "Arras, notaría y toda la documentación", "Incluido"],
  ["Reforma", "Proyecto y obra con equipo propio, presupuesto cerrado", "Opcional"],
  ["Suministros y trámites", "Cambios de luz, agua y gas, y gestiones", "Incluido"],
  ["Postventa", "Seguimos a tu lado después de la firma", "Incluido"],
];

export const UPDATES_360 = [
  { titulo: "Compramos contigo", subtitulo: "Búsqueda y negociación", img: `${A}/edificio-dia.jpg` },
  { titulo: "Reformamos por ti", subtitulo: "Equipo de obra propio", img: `${A}/cocina.jpg` },
  { titulo: "Te damos las llaves", subtitulo: "Listo para vivir", img: `${A}/salon.jpg` },
];

export const REVIEWS = [
  { texto: "Compramos nuestro primer piso y además lo reformaron. Presupuesto cerrado, plazos cumplidos y siempre la misma persona al teléfono.", nombre: "Laura y Diego", tipo: "Compra + reforma · Agra del Orzán", ini: "LD" },
  { texto: "Vendieron mi piso en tres semanas y a un precio mejor del que esperaba. Me lo explicaron todo con mucha paciencia.", nombre: "Manuel R.", tipo: "Venta · Ciudad Vieja", ini: "MR" },
  { texto: "Buscaba inversión y me presentaron opciones que no estaban publicadas. Trato cercano y muy profesional.", nombre: "Carmen F.", tipo: "Personal shopper · A Coruña", ini: "CF" },
  { texto: "Se encargaron de la hipoteca, la notaría y hasta del cambio de la luz. No tuve que preocuparme de nada.", nombre: "Iago P.", tipo: "Compra · Mesoiro", ini: "IP" },
  { texto: "Alquilamos con ellos y encontraron al inquilino ideal en pocos días. Muy recomendables.", nombre: "Rosa y Antonio", tipo: "Alquiler · Oleiros", ini: "RA" },
];

export const FAQS: Array<[string, string]> = [
  ["¿Cobráis algo al comprador?", "No. Nuestros honorarios los asume el vendedor; para quien compra, la asesoría y las visitas son gratuitas."],
  ["¿Reformáis pisos que no compro con vosotros?", "Sí. Reformamos cualquier vivienda o local, sea tuyo desde hace años o recién comprado. Y si compras con nosotros, presupuestamos la reforma antes de las arras."],
  ["¿Cuánto tarda una reforma integral?", "Entre 8 y 14 semanas según superficie y alcance. La fecha de entrega va siempre en el contrato."],
  ["¿Cómo valoráis mi piso?", "Visita gratuita y comparables reales cerrados en tu zona en los últimos meses. Informe por escrito en 48 horas."],
];

export const BUSQUEDAS = [
  "A Coruña",
  "Ciudad Vieja – Centro",
  "Agra del Orzán – Ventorrillo",
  "Mesoiro",
  "Bergondo",
  "Puebla del Caramiñal",
  "Vimianzo",
  "Santanyí",
  "Cala d'Or",
];

export const INTERESES = ["Comprar", "Alquilar", "Vender", "Reformar"] as const;

export const ENERGIA = [
  ["A", "#3a8a4f"],
  ["B", "#5c9e45"],
  ["C", "#a3b83a"],
  ["D", "#d9b52f"],
  ["E", "#d98b2b"],
  ["F", "#c9602a"],
  ["G", "#b5483a"],
] as const;

export const OFICINA = {
  direccion: "C/ de la Merced, 57 bajo",
  ciudad: "15009 A Coruña",
  telefono: "664 859 306",
  email: "oficina@rehabinco.com",
  maps: "https://www.google.com/maps/search/?api=1&query=Rehabinco%2C%20Calle%20de%20la%20Merced%2057%2C%2015009%20A%20Coru%C3%B1a",
};

export const WA = "34664859306";

/** Perfil oficial: https://www.instagram.com/rehabinco1/ */
export const INSTAGRAM = "https://www.instagram.com/rehabinco1/";
