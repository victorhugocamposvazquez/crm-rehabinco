import { EMPRESA_DOCUMENTOS, clausulaProteccionDatosContrato, htmlEsc } from "./empresa-documentos";
import { cssExportContratoArras, cssPreviewEditableArras } from "./contrato-arras-preview";
import { envolverFlujoDocumento } from "./documentos-paginacion";
import { envolverDocumentoHtml, slugArchivo } from "./documentos-pdf";
import { htmlConNegrita } from "./contrato-arras-pdf";
import {
  eurosEnPalabras,
  encabezadoContratoArras,
  listarPersonasArras,
  nombrePersonaArras,
  parrafoReunidos,
  personaArrasVacia,
  verboPropiedad,
  type PersonaArras,
} from "./contrato-arras";
import type {
  ClausulaPagoAplazadoKey,
  ClausulasPersonalizadasPagoAplazado,
  ContratoPagoAplazadoDatos,
} from "./contrato-pago-aplazado";

function nombresAResaltar(personas: PersonaArras[]): string[] {
  const list = personas.length ? personas : [personaArrasVacia("Don")];
  return list.map(nombrePersonaArras);
}

function hueco(valor: string | null | undefined, fallback = "………………") {
  const t = valor?.trim();
  return t || fallback;
}

function aplicarPersonalizacion(
  key: ClausulaPagoAplazadoKey,
  generado: string,
  personalizadas: ClausulasPersonalizadasPagoAplazado
): string {
  const custom = personalizadas[key]?.trim();
  return custom || generado;
}

function h(texto: string) {
  return `<p data-bloque="1" data-titulo-seccion="1" style="margin:18px 0 10px;font-size:13.5px;font-weight:700;letter-spacing:0.04em;">${htmlEsc(texto)}</p>`;
}

function bloqueEditable(key: ClausulaPagoAplazadoKey, innerHtml: string, extraStyle = "") {
  return `<p data-bloque="1" data-clausula="${key}" contenteditable="true" style="margin:0 0 11px;font-size:13px;line-height:1.48;text-align:justify;${extraStyle}">${innerHtml}</p>`;
}

function bloqueEstatico(innerHtml: string, extraStyle = "") {
  return `<p data-bloque="1" style="margin:0 0 11px;font-size:13px;line-height:1.48;text-align:justify;${extraStyle}">${innerHtml}</p>`;
}

export function textosContratoPagoAplazado(datos: ContratoPagoAplazadoDatos) {
  const personalizadas = datos.clausulas_personalizadas ?? {};
  const vendedores = listarPersonasArras(datos.vendedores);
  const compradores = listarPersonasArras(datos.compradores);
  const { son, propietarios } = verboPropiedad(datos.vendedores);
  const generados = {
    encabezado: encabezadoContratoArras(datos),
    reunidosVendedores: `DE UNA PARTE, ${parrafoReunidos(datos.vendedores, "vendedora")}`,
    reunidosCompradores: `Y, DE OTRA PARTE, ${parrafoReunidos(datos.compradores, "compradora")}`,
    intervienen:
      "Intervienen ambos en su propio nombre y derecho y se reconocen mutuamente la capacidad necesaria en derecho para obligarse, lo que de común acuerdo efectúan por medio del presente documento y a tal fin:",
    exponenI: `I. Que ${vendedores} ${son} ${propietarios}, en pleno dominio del siguiente inmueble: ${hueco(datos.finca_descripcion)}.`,
    exponenII: `II. Que le pertenece a ${vendedores} ${hueco(datos.titulo_adquisicion, "por título adquisitivo ………………")}.`,
    exponenIII: `III. Que ${vendedores} manifiesta que la referida finca se encuentra libre de cargas y gravámenes, según nota simple expedida por el Registro de la Propiedad el día de hoy, y que se une a este documento. Asimismo, manifiesta la propiedad que se encuentra libre de arrendamientos y sin ocupantes.`,
    exponenIV:
      "IV. Que estando interesados ambos comparecientes en la compraventa de la finca descrita, por medio del presente documento lo llevan a efecto con arreglo a las siguientes",
    primera: `Primera.- Compraventa. ${vendedores}, vende y ${compradores}, que la compra, la vivienda descrita en el expositivo I de este documento, con los elementos que le son inherentes y/o accesorios, libre de cargas y gravámenes, y al corriente en el pago de contribuciones, arbitrios e impuestos y al corriente en el pago de gastos comunes de propiedad horizontal.`,
    segunda: `Segunda.- Precio. El precio convenido por la presente compraventa es el de ${eurosEnPalabras(datos.precio)}, que abonará la parte compradora a la vendedora en la siguiente forma:
Mediante la entrega que la parte compradora hace en este acto, sirviendo el presente documento como eficaz carta de pago y recibo, de la cantidad de ${eurosEnPalabras(datos.pago_inicial)}.
Un pago mensual de ${eurosEnPalabras(datos.cuota_mensual)}, que irá abonando desde ${hueco(datos.cuota_desde)} y durante un plazo máximo de tres años, mediante transferencia bancaria a la cuenta corriente nº ${hueco(datos.cuenta_vendedora)} de la que es titular la parte vendedora.
El resto del precio pactado, es decir, la cantidad que reste por abonar de la cantidad del punto 1 y las cantidades mensuales abonadas hasta el momento de otorgamiento de la escritura, se satisfará por la parte compradora en el plazo máximo de tres años desde la fecha del presente documento.`,
    tercera: `Tercera.- Otorgamiento de escritura. La escritura pública de compraventa se otorgará, una vez satisfecho el primer pago y en un plazo máximo de ${hueco(datos.plazo_escritura)}, a simple requerimiento de cualquiera de los comparecientes ante el Notario que designe el requirente.
Los gastos e impuestos que se deriven de dicho otorgamiento serán satisfechos por las partes con arreglo a Ley, y por tanto cada compareciente satisfará la parte de Notaría que reglamentariamente le corresponda, la parte vendedora el Impuesto Municipal sobre el Incremento del Valor de los Terrenos de Naturaleza Urbana (plusvalía) y la parte compradora el Impuesto sobre Transmisiones y Actos Jurídicos Documentados y los gastos de gestión y los honorarios por la inscripción de la compraventa en el Registro de la Propiedad.`,
    cuarta: `Cuarta.- Posesión. La parte compradora tomará posesión del inmueble objeto de la compraventa en el plazo máximo de ${hueco(datos.plazo_posesion)}, a contar desde la fecha en que se haya completado el primer pago de la presente compraventa, momento en que la parte vendedora deberá dejarla libre, vacua y expedita y a disposición de la parte compradora, si bien ya desde este momento manifiesta la parte compradora que conoce la realidad física, registral y urbanística del inmueble, renunciando a efectuar cualquier reclamación por vicios o defectos ocultos, en tanto en el momento de tomar posesión no se haya alterado esta situación.
Hasta el momento de entregar la posesión del inmueble la parte vendedora satisfará todos los gastos que se devenguen tanto por la posesión como por la propiedad del inmueble. Desde dicha fecha serán de cuenta y cargo de la parte compradora.
Asimismo, no teniendo el inmueble uso de vivienda en el momento de la firma del presente contrato de compraventa, y siendo la parte compradora conocedora de dicha situación, la misma asume todo gasto derivado de la regularización y registro de dicho inmueble.`,
    quinta: `Quinta.- Resolución por incumplimiento. Será de cuenta de quien incumpla las obligaciones que se derivan del presente documento, la totalidad de gastos que suponga a la otra parte exigir su cumplimiento, tanto judiciales como extrajudiciales, incluidos derechos de Procuradores de los Tribunales y Honorarios de Abogados, aun cuando su intervención no haya sido preceptiva por ley.
En caso de que, pasados tres años desde la fecha del presente documento no se haya efectuado por la parte compradora la totalidad del pago estipulado, ambas partes pactan que dicho incumplimiento conllevará una penalización mensual igual a ${eurosEnPalabras(datos.penalizacion_mensual)} del valor de la renta mensual pactada en el punto 2 del expositivo segundo, más ${eurosEnPalabras(datos.pago_inicial)} del primer pago inicial.`,
    sexta: clausulaProteccionDatosContrato({ prefijo: "Sexta.-" }),
    cierre:
      "Leído el presente documento, los comparecientes lo encuentran conforme con su voluntad, por lo que se ratifican en su contenido y lo suscriben por duplicado, quedando un ejemplar en poder de cada parte, todo ello en la Ciudad y fecha que figura en el encabezamiento.",
  } satisfies Record<ClausulaPagoAplazadoKey, string>;

  const textos = {} as Record<ClausulaPagoAplazadoKey, string>;
  for (const key of Object.keys(generados) as ClausulaPagoAplazadoKey[]) {
    textos[key] = aplicarPersonalizacion(key, generados[key], personalizadas);
  }
  return textos;
}

export function htmlContratoPagoAplazado(
  datos: ContratoPagoAplazadoDatos,
  opts?: { editable?: boolean }
): string {
  const t = textosContratoPagoAplazado(datos);
  const nombres = [...nombresAResaltar(datos.vendedores), ...nombresAResaltar(datos.compradores)];
  const editable = opts?.editable !== false;
  const render = (s: string, extra: string[] = []) =>
    htmlConNegrita(s, [...nombres, ...extra]).replace(/\n/g, "<br />");
  const clausula = (key: ClausulaPagoAplazadoKey, inner: string, extra = "") =>
    editable ? bloqueEditable(key, inner, extra) : bloqueEstatico(inner, extra);

  const bloques =
    clausula("encabezado", render(t.encabezado), "text-align:center;margin-bottom:22px;font-size:13.5px;") +
    h("REUNIDOS") +
    clausula("reunidosVendedores", render(t.reunidosVendedores)) +
    clausula("reunidosCompradores", render(t.reunidosCompradores)) +
    h("INTERVIENEN") +
    clausula("intervienen", render(t.intervienen)) +
    h("EXPONEN") +
    clausula("exponenI", render(t.exponenI)) +
    clausula("exponenII", render(t.exponenII)) +
    clausula("exponenIII", render(t.exponenIII)) +
    clausula("exponenIV", render(t.exponenIV)) +
    h("ESTIPULACIONES") +
    clausula("primera", render(t.primera)) +
    clausula("segunda", render(t.segunda)) +
    clausula("tercera", render(t.tercera)) +
    clausula("cuarta", render(t.cuarta)) +
    clausula("quinta", render(t.quinta)) +
    clausula("sexta", render(t.sexta)) +
    clausula("cierre", render(t.cierre), "margin-top:18px;") +
    `<div data-bloque="1" data-evitar-corte="1" class="pdf-firmas" style="margin-top:36px;display:flex;justify-content:space-between;gap:40px;">
        <div style="flex:1;text-align:center;">
          <p style="margin:0 0 64px;font-size:13px;font-weight:700;letter-spacing:0.04em;">LA PARTE VENDEDORA</p>
          <div style="border-top:1px solid #222;"></div>
        </div>
        <div style="flex:1;text-align:center;">
          <p style="margin:0 0 64px;font-size:13px;font-weight:700;letter-spacing:0.04em;">LA PARTE COMPRADORA</p>
          <div style="border-top:1px solid #222;"></div>
        </div>
      </div>`;

  const body = envolverFlujoDocumento(bloques);
  return envolverDocumentoHtml({
    title: `Compraventa aplazada · ${EMPRESA_DOCUMENTOS.razonSocial}`,
    body,
    serif: true,
    extraCss: editable ? cssPreviewEditableArras() : cssExportContratoArras(),
  });
}

export function htmlContratoPagoAplazadoExport(datos: ContratoPagoAplazadoDatos): string {
  return htmlContratoPagoAplazado(datos, { editable: false });
}

export function contratoPagoAplazadoPdfFilename(datos: ContratoPagoAplazadoDatos): string {
  const quien = slugArchivo(datos.compradores[0]?.nombre || datos.vendedores[0]?.nombre || "", "aplazado");
  const fecha = datos.fecha?.slice(0, 10) || String(new Date().getFullYear());
  return `Compraventa-aplazada-${fecha}-${quien}.pdf`;
}

export async function downloadContratoPagoAplazadoPdf(datos: ContratoPagoAplazadoDatos) {
  const { prepararDocumentoExportHtml } = await import("./documentos-paginacion");
  const { downloadPagedHtmlPdf } = await import("./documentos-pdf");
  const html = await prepararDocumentoExportHtml(htmlContratoPagoAplazadoExport(datos));
  await downloadPagedHtmlPdf({
    html,
    filename: contratoPagoAplazadoPdfFilename(datos),
    ajustarAltura: true,
  });
}
