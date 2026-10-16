import { EMPRESA_DOCUMENTOS } from "@/lib/empresa-documentos";

export type BloqueLegal = { id: string; titulo: string; parrafos: string[] };

const e = EMPRESA_DOCUMENTOS;

export function bloquesAvisoLegal(): BloqueLegal[] {
  return [
    {
      id: "identificacion",
      titulo: "1. Datos identificativos",
      parrafos: [
        `En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa que el titular de este sitio web es ${e.razonSocial}, con CIF ${e.cif}, domicilio en ${e.direccionCompleta}, teléfono ${e.telefono} y correo electrónico ${e.email}.`,
        `Denominación comercial: Rehabinco. Sitio web: https://${e.web.replace(/^www\./, "")} (y dominios asociados al servicio inmobiliario).`,
      ],
    },
    {
      id: "objeto",
      titulo: "2. Objeto",
      parrafos: [
        "Este sitio web tiene por objeto facilitar al público información sobre los servicios de mediación inmobiliaria, reformas y actividades relacionadas de Rehabinco, así como la consulta de inmuebles en venta o alquiler y canales de contacto con la agencia.",
      ],
    },
    {
      id: "condiciones",
      titulo: "3. Condiciones de uso",
      parrafos: [
        "El acceso y la navegación implican la aceptación de este aviso legal y de la política de cookies. El usuario se compromete a hacer un uso diligente, lícito y conforme a la buena fe, sin dañar la imagen de Rehabinco ni interferir en el funcionamiento del sitio.",
        "Queda prohibida la reproducción, distribución o transformación de contenidos (textos, imágenes, logotipos, diseño o código) sin autorización expresa de Rehabinco, salvo uso privado no comercial permitido por la ley.",
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
        "Rehabinco no se hace responsable de los daños derivados de interferencias, virus informáticos o incidencias ajenas a un mantenimiento razonable del servicio. La información sobre inmuebles tiene carácter orientativo y puede modificarse; la oferta vinculante se formaliza en la documentación contractual correspondiente.",
        "Los enlaces a sitios de terceros se facilitan únicamente a título informativo; Rehabinco no controla ni responde de sus contenidos.",
      ],
    },
    {
      id: "datos",
      titulo: "6. Protección de datos",
      parrafos: [
        `Responsable del tratamiento: ${e.razonSocial} (CIF ${e.cif}), ${e.direccionCompleta}. Contacto: ${e.email} y ${e.telefono}.`,
        "Tratamos los datos que nos facilitas a través de formularios, WhatsApp, correo electrónico o llamada para atender consultas, gestionar visitas y, en su caso, relaciones comerciales o contractuales inmobiliarias. La base legal suele ser la ejecución de medidas precontractuales o contractuales, el consentimiento o el interés legítimo, según el caso.",
        "Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad, así como retirar el consentimiento cuando corresponda, escribiendo a la dirección indicada. Si consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).",
        "Consulta también nuestra política de cookies para información sobre tecnologías similares en tu dispositivo.",
      ],
    },
    {
      id: "ley",
      titulo: "7. Legislación y jurisdicción",
      parrafos: [
        "Las relaciones con los usuarios del sitio web se rigen por la legislación española. Para la resolución de controversias, las partes se someten a los Juzgados y Tribunales de A Coruña, salvo que la normativa de consumidores y usuarios disponga otro fuero imperativo.",
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
        "Las cookies son pequeños archivos que se almacenan en tu navegador cuando visitas un sitio web. También usamos almacenamiento local del navegador para recordar tus preferencias de cookies, con un efecto similar.",
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
        "Necesarias: imprescindibles para que el sitio funcione (por ejemplo, recordar que has aceptado o configurado las cookies). No requieren consentimiento.",
        "Preferencias: permiten recordar opciones de navegación o idioma cuando las activemos. Solo se instalan si las aceptas.",
        "Analíticas: nos ayudan a medir de forma agregada cómo se usa la web para mejorarla. Solo se instalan si las aceptas.",
        "Marketing: relacionadas con publicidad personalizada o redes sociales cuando integremos esos servicios. Solo se instalan si las aceptas.",
      ],
    },
    {
      id: "gestion",
      titulo: "4. Cómo gestionar tu consentimiento",
      parrafos: [
        "Al entrar por primera vez verás un banner donde puedes aceptar todas las cookies, rechazar las no necesarias o elegir categorías concretas. Puedes cambiar tu decisión en cualquier momento borrando las cookies del navegador o usando de nuevo el enlace «Cookies» del pie de página, que volverá a mostrar el panel de configuración.",
      ],
    },
    {
      id: "terceros",
      titulo: "5. Cookies de terceros",
      parrafos: [
        "Si enlazamos a Instagram, WhatsApp, Google Maps u otros servicios, esos proveedores pueden instalar sus propias cookies cuando interactúas con ellos. Te recomendamos consultar sus políticas de privacidad.",
        "En el dominio de la web pública no utilizamos cookies de sesión del CRM salvo que accedas expresamente al área privada del CRM en su dominio correspondiente.",
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

export const FECHA_LEGAL = "16 de octubre de 2026";
