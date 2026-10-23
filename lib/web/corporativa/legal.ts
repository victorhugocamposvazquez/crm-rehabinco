import { EMPRESA_DOCUMENTOS } from "@/lib/empresa-documentos";

export type BloqueLegal = { id: string; titulo: string; parrafos: string[] };

const e = EMPRESA_DOCUMENTOS;

export function bloquesAvisoLegal(): BloqueLegal[] {
  return [
    {
      id: "identificacion",
      titulo: "1. Datos identificativos",
      parrafos: [
        `En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información (LSSI-CE), el titular de este sitio es ${e.razonSocial}, con nombre comercial Rehabinco, CIF ${e.cif}, domicilio en ${e.direccionCompleta}, teléfono ${e.telefono} y correo ${e.email}.`,
        `${e.razonSocial} está inscrita en el Registro Mercantil de A Coruña. Tomo, folio y hoja no constan aún en esta página: se facilitan en ${e.email} y se incorporarán aquí en cuanto se transcriban. No pertenece a un colegio profesional obligatorio ni consta una autorización administrativa específica para la intermediación inmobiliaria en Galicia.`,
        `Sitio: https://${e.web.replace(/^www\./, "")}. La actividad es la intermediación inmobiliaria (compraventa y arrendamiento) y la contratación y ejecución de reformas.`,
      ],
    },
    {
      id: "objeto",
      titulo: "2. Objeto",
      parrafos: [
        "La web informa de la intermediación inmobiliaria y de las reformas de Rehabinco, permite consultar inmuebles y ofrece canales de contacto. La información de la web no sustituye al encargo de intermediación, al contrato de arrendamiento o compraventa, ni al presupuesto o contrato de obra.",
      ],
    },
    {
      id: "condiciones",
      titulo: "3. Condiciones de uso",
      parrafos: [
        "El acceso y la navegación implican la aceptación de este aviso legal y de la política de cookies. El usuario se compromete a hacer un uso diligente, lícito y conforme a la buena fe, sin dañar la imagen de Rehabinco ni interferir en el funcionamiento del sitio.",
        "Queda prohibida la reproducción, distribución o transformación de contenidos (textos, imágenes, logotipos, diseño o código) sin autorización expresa de Rehabinco, salvo el uso privado no comercial que permita la ley.",
        "Los precios de los inmuebles se muestran como información comercial. El precio de una reforma y si incluye o no el IVA se fijan en el presupuesto. Nada de lo publicado en la web es una oferta contractual cerrada hasta que Rehabinco y el cliente lo documenten.",
      ],
    },
    {
      id: "propiedad",
      titulo: "4. Propiedad intelectual e industrial",
      parrafos: [
        "Los derechos de propiedad intelectual e industrial sobre el sitio web, su diseño, marcas, logotipos y contenidos son titularidad de Rehabinco o de terceros licenciantes. Las fotografías de inmuebles pueden estar sujetas a derechos de autor de sus autores.",
      ],
    },
    {
      id: "responsabilidad",
      titulo: "5. Responsabilidad",
      parrafos: [
        "Rehabinco procura que los datos del anuncio (precio, superficie, distribución y, cuando la norma lo exige para vender o alquilar, la calificación energética) sean veraces. Pueden cambiar y tienen carácter orientativo hasta que se contrasten en la visita y en la documentación. La dirección exacta puede ocultarse hasta la visita por seguridad del inmueble.",
        "En las reformas, el alcance, el plazo y el precio son los del presupuesto aceptado. Si la obra queda sujeta a la Ley 38/1999 de ordenación de la edificación, se aplican sus plazos de garantía (con carácter general, un año para defectos de terminación o acabado, tres para habitabilidad y diez para daños estructurales que comprometan la resistencia mecánica). En el resto de trabajos rige la conformidad del bien o servicio con el texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios.",
        "Si contratas a distancia o fuera del establecimiento, puedes tener catorce días para desistir, salvo las excepciones del artículo 103 de esa ley: entre otras, cuando la obra se ejecuta sobre un inmueble o cuando pides que el servicio empiece antes de que acabe ese plazo y se te informa de que pierdes el desistimiento al ejecutarse por completo.",
        "Rehabinco no responde de interrupciones, virus o usos indebidos ajenos a un mantenimiento razonable. Los enlaces a terceros (portales, mapas, redes o WhatsApp) se ofrecen para tu comodidad; su contenido y sus condiciones son de quien los presta.",
      ],
    },
    {
      id: "prl",
      titulo: "6. Prevención de riesgos en las reformas",
      parrafos: [
        "La obra no se anuncia como un trámite de la web: la seguridad se organiza en el tajo. Rehabinco, cuando emplea personal o dirige la reforma, cumple la Ley 31/1995 de prevención de riesgos laborales: evaluación de riesgos, formación, equipos y vigilancia de la salud a través del servicio de prevención que tenga concertado.",
        "Si la reforma es una obra de construcción en el sentido del Real Decreto 1627/1997, hacen falta el estudio o estudio básico de seguridad y salud, el plan de seguridad y salud antes de empezar, y el libro de incidencias. Cuando en la obra coinciden empresas, hay coordinación de seguridad (en proyecto y en ejecución, si la norma lo exige) y coordinación de actividades empresariales (Real Decreto 171/2004).",
        "Los industriales que subcontrate Rehabinco tienen que estar en el Registro de Empresas Acreditadas y respetar los límites de la cadena de subcontratación de la Ley 32/2006. En la obra se lleva el libro de subcontratación. La modalidad del servicio de prevención y el número de acreditación no se publican aquí: constan en el contrato y en el plan de seguridad, y se facilitan al cliente y a la Inspección de Trabajo si los piden.",
        "Quien encarga la reforma deja acceso seguro a la vivienda, aparta lo que estorbe en las zonas de trabajo y no entra en la obra si se le indica que hay riesgo. Esas reglas se concretan en el presupuesto o en el plan, no en esta página.",
      ],
    },
    {
      id: "datos",
      titulo: "7. Protección de datos",
      parrafos: [
        `El detalle de finalidades, bases jurídicas, plazos, destinatarios y derechos está en la política de privacidad. El responsable es ${e.razonSocial} (CIF ${e.cif}), ${e.direccionCompleta}, ${e.email}.`,
        "El contacto en la web es por teléfono, por correo o por WhatsApp. Si abres WhatsApp, el mensaje lo trata también su proveedor. El detalle de ese tratamiento está en la política de privacidad, enlazada junto al botón.",
      ],
    },
    {
      id: "comunicaciones",
      titulo: "8. Comunicaciones comerciales",
      parrafos: [
        "No enviaremos publicidad por email, SMS o medios equivalentes sin tu consentimiento, salvo el supuesto del artículo 21.2 de la LSSI: si ya eres cliente, podemos informarte de servicios inmobiliarios o de reforma similares a los contratados, indicando en cada mensaje que eres cliente y cómo oponerte, de forma sencilla y gratuita.",
        "Cada comunicación comercial identificará a Rehabinco como remitente.",
      ],
    },
    {
      id: "ley",
      titulo: "9. Legislación y jurisdicción",
      parrafos: [
        "Este sitio se rige por la ley española. Si actúas como consumidor, conservas el fuero que te reconozca la norma de consumidores y usuarios. En los demás casos, las partes se someten a los juzgados y tribunales de A Coruña.",
      ],
    },
  ];
}

export function bloquesPoliticaCookies(): BloqueLegal[] {
  return [
    {
      id: "que-son",
      titulo: "1. ¿Qué son las cookies?",
      parrafos: [
        "Las cookies son pequeños archivos que el sitio guarda en tu navegador. La de Rehabinco solo recuerda la elección que hagas en el banner.",
      ],
    },
    {
      id: "responsable",
      titulo: "2. Responsable",
      parrafos: [
        `${e.razonSocial}, CIF ${e.cif}, ${e.direccionCompleta}. Email: ${e.email}.`,
      ],
    },
    {
      id: "tipos",
      titulo: "3. Tipos de cookies que utilizamos",
      parrafos: [
        "Hoy la web solo instala una cookie propia y necesaria: rh_cookie_consent. Guarda si aceptaste, rechazaste o configuraste las categorías, durante doce meses. No identifica tu nombre. No requiere consentimiento porque solo recuerda esa elección (artículo 22.2 de la LSSI).",
        "El panel permite activar preferencias, analítica y marketing. Esas categorías no instalan cookies de terceros mientras Rehabinco no conecte una herramienta de medición o publicidad. Si se conecta, no se cargará hasta que la categoría esté aceptada, y esta política listará el nombre, el proveedor y la duración.",
      ],
    },
    {
      id: "gestion",
      titulo: "4. Cómo gestionar tu consentimiento",
      parrafos: [
        "Al entrar verás un banner para aceptar todas, rechazar las no necesarias o elegir categorías. Puedes cambiar la decisión en «Configurar cookies», en el pie de la web, o borrando las cookies del navegador.",
      ],
    },
    {
      id: "terceros",
      titulo: "5. Cookies de terceros",
      parrafos: [
        "Instagram y WhatsApp son enlaces. No incrustamos sus contenidos, así que no instalan cookies por el mero hecho de ver la web. Si abres WhatsApp, Meta trata el mensaje conforme a su política.",
        "El mapa de Google de la ficha de un inmueble no se carga hasta que pulsas «Cargar mapa». En ese momento Google puede instalar cookies o tratar la dirección IP. Puedes no cargarlo y abrir el enlace externo.",
        "La web pública no usa la cookie de sesión del CRM. Esa cookie solo aparece si entras en el área privada, en su propio dominio.",
      ],
    },
    {
      id: "actualizacion",
      titulo: "6. Actualizaciones",
      parrafos: [
        "Podemos actualizar esta política para adaptarla a cambios legales o técnicos. La fecha de la última revisión se indica al final del documento.",
      ],
    },
  ];
}

export const FECHA_LEGAL = "21 de octubre de 2026";

export function bloquesPoliticaPrivacidad(): BloqueLegal[] {
  return [
    {
      id: "responsable",
      titulo: "1. Responsable del tratamiento",
      parrafos: [
        `El responsable es ${e.razonSocial} (Rehabinco), CIF ${e.cif}, domicilio en ${e.direccionCompleta}, teléfono ${e.telefono} y correo ${e.email}.`,
        "No hay delegado de protección de datos designado: para esta actividad no es obligatorio. Las solicitudes de privacidad se atienden en el mismo correo.",
      ],
    },
    {
      id: "ambito",
      titulo: "2. A quién se aplica",
      parrafos: [
        "Esta política informa a quienes usan la web, piden información, encargan la venta o el alquiler de un inmueble, solicitan una visita, piden un presupuesto de reforma o contratan esos servicios.",
        "Rehabinco intermedia en compraventa y arrendamiento de inmuebles y ejecuta reformas. Los datos se tratan para esas dos actividades y para las obligaciones legales que las acompañan.",
      ],
    },
    {
      id: "datos",
      titulo: "3. Qué datos tratamos y de dónde salen",
      parrafos: [
        "Los facilitas tú: nombre, teléfono, email, mensaje, inmueble de interés, datos del encargo de venta o alquiler, y los del presupuesto o la obra (dirección, mediciones, fotos del estado del inmueble y preferencias de obra).",
        "Si la relación llega a una compraventa intermediada, podemos pedirte documento de identidad y datos de la operación para cumplir la normativa de prevención del blanqueo de capitales. No los pedimos para una simple consulta en la web.",
        "Datos técnicos de la visita al sitio: dirección IP abreviada en registros del servidor, tipo de navegador y la cookie que guarda tu elección sobre cookies. El simulador de cuota hipotecaria de la ficha se calcula en tu navegador: no nos envía esos importes ni decide nada por ti.",
        "No tratamos datos de menores de forma consciente. Si un menor nos escribe, suprimiremos el mensaje en cuanto lo detectemos, salvo que un progenitor contrate en su nombre.",
      ],
    },
    {
      id: "finalidades",
      titulo: "4. Para qué los usamos y con qué base",
      parrafos: [
        "Atender el correo, el teléfono o WhatsApp, concertar visitas y preparar una propuesta inmobiliaria o de reforma. Base: medidas precontractuales o contrato, a petición tuya (artículo 6.1.b del RGPD). Si el mensaje no llega a ser una solicitud de servicio, la base es tu consentimiento (artículo 6.1.a).",
        "Gestionar el encargo de intermediación (venta, alquiler o búsqueda) y la ejecución de la reforma: visitas, documentación del inmueble, presupuesto, planificación de obra y comunicación con el cliente. Base: contrato (artículo 6.1.b).",
        "Emitir facturas, llevar la contabilidad y atender requerimientos de Hacienda o de un juzgado. Base: obligación legal (artículo 6.1.c). Las facturas y libros se conservan el plazo mercantil y tributario (con carácter general, seis años los libros y cuatro el plazo de prescripción tributaria, salvo que una norma exija más).",
        "Identificar a las partes cuando Rehabinco intermedia una compraventa de inmueble, conforme a la Ley 10/2010 de prevención del blanqueo de capitales. Base: obligación legal. Esos datos se conservan diez años desde que termina la relación de negocio sujeta a esa ley.",
        "Enviarte información comercial de servicios inmobiliarios o de reforma parecidos a los que ya nos has pedido, con un enlace o aviso para darte de baja en cada envío. Base: interés legítimo y el artículo 21.2 de la LSSI cuando ya eres cliente. Cualquier otra newsletter o publicidad exige tu consentimiento, que puedes retirar cuando quieras.",
        "Mantener la web segura y recordar si aceptaste cookies no necesarias. Base: interés legítimo en la seguridad, y consentimiento para las cookies que no son imprescindibles (artículo 22.2 de la LSSI).",
        "Publicar un inmueble (fotos, precio, referencia) solo con el encargo de quien puede disponer de él. Si una imagen mostrara a personas identificables, no la usaremos sin una base que lo permita.",
        "En las reformas, identificar a trabajadores propios e industriales (nombre, formación preventiva y si están aptos para el puesto, nunca el historial médico) para coordinar la seguridad en la obra. Base: obligación legal. Se conservan mientras dura la obra y el tiempo en que pueda exigirse esa documentación.",
      ],
    },
    {
      id: "plazos",
      titulo: "5. Cuánto tiempo los guardamos",
      parrafos: [
        "Consultas que no llegan a encargo: hasta veinticuatro meses desde el último contacto, para poder retomar la búsqueda o la reforma si vuelves a escribir. Puedes pedir el borrado antes.",
        "Encargos, contratos, presupuestos aceptados y expedientes de obra: mientras dure la relación y, después, los plazos de reclamación y de garantía. En obra sujeta a la Ley de Ordenación de la Edificación, las garantías legales pueden llegar a uno, tres o diez años según el daño; la documentación se conserva al menos ese tiempo.",
        "Documentación de prevención del blanqueo en compraventas intermediadas: diez años. Facturación y contabilidad: los plazos indicados en el apartado anterior.",
        "La cookie de consentimiento dura doce meses. Los registros técnicos de seguridad, el tiempo imprescindible para detectar abusos, y en todo caso no más de doce meses salvo incidencia que obligue a conservarlos.",
      ],
    },
    {
      id: "destinatarios",
      titulo: "6. Quién puede recibirlos",
      parrafos: [
        "El personal de Rehabinco que necesite el dato para el encargo. No vendemos datos ni los cedemos para publicidad de terceros.",
        "Encargados que prestan un servicio a Rehabinco: alojamiento de la web, correo y el sistema interno de gestión. Solo tratan los datos siguiendo nuestras instrucciones.",
        "Si pulsas WhatsApp, el mensaje lo recibe también WhatsApp (Meta), con su propia política. Instagram solo se abre si tú entras en el enlace; no incrustamos su contenido en la web.",
        "El mapa de una ficha no se carga solo. Si pulsas «Cargar mapa», Google puede tratar datos técnicos de esa petición. También puedes abrir Google Maps o Apple Maps en una pestaña nueva.",
        "Cuando el servicio lo exige: notaría, registro de la propiedad, portal inmobiliario en el que el propietario haya autorizado publicar, colaboradores de obra (industriales) limitados a lo necesario para ejecutar la reforma, entidad financiera si nos pides que tramitemos financiación, aseguradora si hay un siniestro, y Administraciones o juzgados cuando una norma lo imponga.",
      ],
    },
    {
      id: "transferencias",
      titulo: "7. Transferencias fuera del Espacio Económico Europeo",
      parrafos: [
        "El alojamiento de la web y, si usas WhatsApp, Meta pueden tratar datos en países fuera del Espacio Económico Europeo. En ese caso la transferencia se apoya en cláusulas contractuales tipo u otra garantía prevista en el RGPD. El resto de tratamientos (visitas, encargos, facturas, obra) se hace desde España.",
      ],
    },
    {
      id: "derechos",
      titulo: "8. Tus derechos",
      parrafos: [
        `Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad, y retirar el consentimiento sin que afecte a lo ya tratado, escribiendo a ${e.email} o por correo postal a ${e.direccionCompleta}. Indicaremos si necesitamos acreditar tu identidad.`,
        "También puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es). Te pedimos que nos escribas antes para intentar resolverlo.",
        "Dar el nombre y un teléfono o email es necesario para responderte. Si no los facilitas, no podremos atender la consulta. El resto de datos solo se pide cuando hace falta para el encargo, la factura o una obligación legal.",
      ],
    },
    {
      id: "automatizadas",
      titulo: "9. Decisiones automatizadas",
      parrafos: [
        "No tomamos decisiones automatizadas ni elaboramos perfiles que produzcan efectos jurídicos sobre ti. El cálculo orientativo de hipoteca de la ficha es una simulación local y no constituye una oferta de financiación.",
      ],
    },
    {
      id: "cambios",
      titulo: "10. Cambios de esta política",
      parrafos: [
        `La revisaremos si cambia la ley o el modo en que trabajamos. La fecha vigente figura al inicio de la página (${FECHA_LEGAL}).`,
      ],
    },
  ];
}
