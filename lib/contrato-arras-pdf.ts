import { EMPRESA_DOCUMENTOS, htmlEsc } from "./empresa-documentos";
import { downloadPagedHtmlPdf, envolverDocumentoHtml, slugArchivo } from "./documentos-pdf";
import {
  encabezadoContratoArras,
  eurosEnPalabras,
  listarPersonasArras,
  nombrePersonaArras,
  parrafoReunidos,
  personaArrasVacia,
  restoPrecio,
  textoHipoteca,
  textoViviendaVenta,
  verboPropiedad,
  type ContratoArrasDatos,
  type PersonaArras,
} from "./contrato-arras";

function p(texto: string, extra = "") {
  return `<p style="margin:0 0 11px;font-size:13px;line-height:1.48;text-align:justify;${extra}">${texto}</p>`;
}

function nombresAResaltar(personas: PersonaArras[]): string[] {
  const list = personas.length ? personas : [personaArrasVacia("Don")];
  return list.map(nombrePersonaArras);
}

/** Escapa el texto y pone en negrita los fragmentos indicados. */
export function htmlConNegrita(texto: string, fragmentos: string[]): string {
  let html = htmlEsc(texto);
  const unicos = [...new Set(fragmentos.map((f) => f.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const fragmento of unicos) {
    const esc = htmlEsc(fragmento);
    html = html.split(esc).join(`<strong>${esc}</strong>`);
  }
  return html;
}

function h(texto: string) {
  return `<p style="margin:18px 0 10px;font-size:13.5px;font-weight:700;letter-spacing:0.04em;">${htmlEsc(texto)}</p>`;
}

function clausulaNovenaLopd(): string {
  const e = EMPRESA_DOCUMENTOS;
  return `NOVENA.- PROTECCIÓN DE DATOS. Responsable: ${e.razonSocial} CIF: ${e.cif}. Dirección: ${e.direccionCompleta}. Teléfono ${e.telefono}. Correo electrónico: ${e.email}.

De conformidad con lo establecido en la normativa vigente en materia de protección de datos de carácter personal, los datos y documentos facilitados por usted son necesarios para un correcto asesoramiento y mediación inmobiliaria. Dichos datos de carácter personal serán tratados por ${e.razonSocial} con la debida discreción y confidencialidad con el fin de llevar a cabo dicha gestión inmobiliaria.

Los datos proporcionados se conservarán durante el tiempo necesario para la finalidad en base a la cual han sido recabados, o para el cumplimiento con las obligaciones legales.

${e.razonSocial} no elaborará ningún tipo de “perfil” en base a la información facilitada. No se tomarán decisiones automatizadas en base a perfiles.

Igualmente, podrá ejercer los derechos de acceso, rectificación, cancelación, supresión, oposición, limitación del tratamiento, portabilidad de datos y a no ser objeto de decisiones individualizadas, automatizadas, en relación con los datos objeto del tratamiento, ante el responsable del tratamiento a la dirección arriba indicada.

En caso de que no haya obtenido satisfacción en el ejercicio de sus derechos, puede presentar una reclamación ante la Autoridad de Control en materia de Protección de Datos competente.`;
}

export function textosContratoArras(datos: ContratoArrasDatos) {
  const vendedores = listarPersonasArras(datos.vendedores);
  const compradores = listarPersonasArras(datos.compradores);
  const { son, propietarios } = verboPropiedad(datos.vendedores);
  const vivienda = textoViviendaVenta(datos.incluye_anejos);
  const anejos = datos.finca_anejos.trim()
    ? datos.finca_anejos.trim()
    : "………………";
  const resto = restoPrecio(datos.precio, datos.arras);
  const plazo = datos.plazo_escritura_dias != null ? String(datos.plazo_escritura_dias) : "……";
  return {
    encabezado: encabezadoContratoArras(datos),
    reunidosVendedores: `De una parte, ${parrafoReunidos(datos.vendedores, "vendedora")}`,
    reunidosCompradores: `Y de otra parte, ${parrafoReunidos(datos.compradores, "compradora")}`,
    intervienen:
      "Todos en su propio nombre y Derecho. Ambas partes se reconocen mutuamente la capacidad legal necesaria para el otorgamiento y firma del presente contrato de arras, para lo cual,",
    exponenI: `I.- Que ${vendedores} ${son} ${propietarios} de la siguiente finca:
Finca 1ª, ${datos.finca_descripcion.trim() || "………………"} que tiene como ANEJOS (si los hubiera): ${anejos}
Inscripción.- Libro ${datos.registro_libro.trim() || "……"}, folio ${datos.registro_folio.trim() || "……"}, finca número ${datos.registro_finca.trim() || "……"}, en el Registro de la Propiedad número ${datos.registro_numero.trim() || "……"}.`,
    exponenII: `II.- Que interesa a ${compradores} la compra de la citada finca, por lo que estipulan ambas partes llevar a efecto el presente contrato de arras sobre la base de las siguientes`,
    primera: `PRIMERA: Los vendedores ${vendedores} están interesados en vender y los compradores ${compradores} están interesados en comprar ${vivienda} en el expositivo primero.`,
    segunda: `SEGUNDA: El precio de esta compraventa se fija en ${eurosEnPalabras(datos.precio)} más los impuestos que resulten aplicables.`,
    tercera: `TERCERA: Que en este acto, la parte compradora entrega en concepto de arras la cantidad de ${eurosEnPalabras(datos.arras)} mediante transferencia bancaria que sale de la cuenta de la parte compradora a la cuenta ${datos.cuenta_vendedora.trim() || "…………………………………………"} a nombre de la parte vendedora. El contrato tendrá validez en el momento que la parte vendedora la reciba en la cuenta.`,
    cuarta: `CUARTA: El resto del precio pactado, esto es, ${eurosEnPalabras(resto)}, lo entregará la parte compradora a la parte vendedora, en el momento de la firma de la escritura pública de compraventa ante notario, que se realizará en un plazo no superior a ${plazo} días a contar desde el día de hoy.
${textoHipoteca(datos.hay_hipoteca)}
La venta concertada se realizará en concepto de libre de cargas, gravámenes y ocupantes, así como al corriente en el pago de todo tipo de contribuciones, impuestos, tasas, arbitrios y gastos de Comunidad.
LOS COMPRADORES se reservan el derecho de elevar a escritura pública la compraventa descrita en este contrato en su propio nombre o en el de las personas que libremente designen.`,
    quinta:
      "QUINTA: Que en el caso de que la parte compradora no cumpliese lo estipulado en este contrato, la cantidad de dinero otorgada en este acto quedará en poder de los propietarios del inmueble objeto de la compraventa.\nAsimismo, si la parte vendedora desistiera de efectuar la compraventa de la finca objeto de este contrato, vendrá obligada a devolver a la parte compradora duplicadas las arras recibidas.",
    sexta:
      "SEXTA: Todos los gastos e impuestos que se originen como consecuencia de esta transmisión correrán a cargo de la parte compradora, excepto el impuesto municipal sobre el incremento del valor de los terrenos de naturaleza urbana, que será satisfecho por la parte vendedora.",
    septima:
      "SÉPTIMA: El pago de los IBI será prorrateado entre vendedores y compradores en proporción al tiempo en que cada una de las partes haya ostentado las titularidades dominicales y por el tiempo que lo sea.",
    octava:
      "OCTAVA.- Las partes, con renuncia expresa a cualquier fuero propio que pudiera corresponderles, se someten voluntariamente a la jurisdicción de los Juzgados y Tribunales de A Coruña ciudad.",
    novena: clausulaNovenaLopd(),
    cierre:
      "Y en prueba de conformidad otorgan y firman este documento por duplicado y a un solo efecto en el lugar y fecha expresados en el encabezamiento.",
  };
}

function pagina(inner: string) {
  return `<div class="pdf-page" style="padding:54px 62px 48px;">${inner}</div>`;
}

export function htmlContratoArras(datos: ContratoArrasDatos): string {
  const t = textosContratoArras(datos);
  const nombres = [...nombresAResaltar(datos.vendedores), ...nombresAResaltar(datos.compradores)];
  const cuenta = datos.cuenta_vendedora.trim() || "…………………………………………";
  const arras = eurosEnPalabras(datos.arras);
  const conNombres = (s: string) => htmlConNegrita(s, nombres);
  const nlNombres = (s: string) => conNombres(s).replace(/\n/g, "<br />");
  const body =
    pagina(`
      <p style="margin:0 0 22px;font-size:13.5px;text-align:center;">${htmlEsc(t.encabezado)}</p>
      ${h("REUNIDOS")}
      ${p(conNombres(t.reunidosVendedores))}
      ${p(conNombres(t.reunidosCompradores))}
      ${h("INTERVIENEN")}
      ${p(htmlEsc(t.intervienen))}
      ${h("EXPONEN")}
      ${p(nlNombres(t.exponenI))}
      ${p(conNombres(t.exponenII))}
      ${h("ESTIPULACIONES:")}
      ${p(conNombres(t.primera))}
    `) +
    pagina(`
      ${p(htmlEsc(t.segunda))}
      ${p(htmlConNegrita(t.tercera, [...nombres, arras, cuenta]))}
      ${p(nlNombres(t.cuarta))}
      ${p(nlNombres(t.quinta))}
      ${p(htmlEsc(t.sexta))}
      ${p(htmlEsc(t.septima))}
      ${p(htmlEsc(t.octava))}
    `) +
    pagina(`
      ${p(htmlEsc(t.novena).replace(/\n/g, "<br />"))}
      ${p(htmlEsc(t.cierre), "margin-top:18px;")}
      <div style="margin-top:36px;display:flex;justify-content:space-between;gap:40px;">
        <div style="flex:1;text-align:center;">
          <p style="margin:0 0 64px;font-size:13px;font-weight:700;letter-spacing:0.04em;">LA PARTE VENDEDORA</p>
          <div style="border-top:1px solid #222;"></div>
        </div>
        <div style="flex:1;text-align:center;">
          <p style="margin:0 0 64px;font-size:13px;font-weight:700;letter-spacing:0.04em;">LA PARTE COMPRADORA</p>
          <div style="border-top:1px solid #222;"></div>
        </div>
      </div>
    `);
  return envolverDocumentoHtml({
    title: `Contrato de arras · ${EMPRESA_DOCUMENTOS.razonSocial}`,
    body,
    serif: true,
  });
}

export function contratoArrasPdfFilename(datos: ContratoArrasDatos): string {
  const quien = slugArchivo(datos.compradores[0]?.nombre || datos.vendedores[0]?.nombre || "", "contrato");
  const fecha = datos.fecha?.slice(0, 10) || String(new Date().getFullYear());
  return `Contrato-arras-${fecha}-${quien}.pdf`;
}

export async function downloadContratoArrasPdf(datos: ContratoArrasDatos) {
  await downloadPagedHtmlPdf({
    html: htmlContratoArras(datos),
    filename: contratoArrasPdfFilename(datos),
  });
}
