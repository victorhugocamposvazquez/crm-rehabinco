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
  personaArrasVacia,
  type PersonaArras,
} from "./contrato-arras";
import {
  fechaDocumentoOHueco,
  type ClausulaArrendamientoKey,
  type ClausulasPersonalizadasArrendamiento,
  type ContratoArrendamientoDatos,
} from "./contrato-arrendamiento";

function nombresAResaltar(personas: PersonaArras[]): string[] {
  const list = personas.length ? personas : [personaArrasVacia("Don")];
  return list.map(nombrePersonaArras);
}

function hueco(valor: string | null | undefined, fallback = "………………") {
  const t = valor?.trim();
  return t || fallback;
}

function parrafoParte(personas: PersonaArras[], rol: "ARRENDADORA" | "ARRENDATARIA"): string {
  const ps = personas.length ? personas : [personaArrasVacia(rol === "ARRENDADORA" ? "Don" : "Doña")];
  const p = ps[0];
  const vecino = p.tratamiento === "Doña" ? "vecina" : "vecino";
  const nombres = listarPersonasArras(ps);
  return `${nombres}, mayor de edad, ${vecino} de ${hueco(p.vecindad, EMPRESA_DOCUMENTOS.lugar)}, con domicilio, a estos efectos, en ${hueco(p.domicilio)}, ${hueco(p.vecindad, EMPRESA_DOCUMENTOS.lugar)}, y con DNI ${hueco(p.dni)}, en adelante, LA PARTE ${rol}.`;
}

function aplicarPersonalizacion(
  key: ClausulaArrendamientoKey,
  generado: string,
  personalizadas: ClausulasPersonalizadasArrendamiento
): string {
  const custom = personalizadas[key]?.trim();
  return custom || generado;
}

function h(texto: string) {
  return `<p data-bloque="1" data-titulo-seccion="1" style="margin:18px 0 10px;font-size:13.5px;font-weight:700;letter-spacing:0.04em;">${htmlEsc(texto)}</p>`;
}

function bloqueEditable(key: ClausulaArrendamientoKey, innerHtml: string, extraStyle = "") {
  return `<p data-bloque="1" data-clausula="${key}" contenteditable="true" style="margin:0 0 11px;font-size:13px;line-height:1.48;text-align:justify;${extraStyle}">${innerHtml}</p>`;
}

function bloqueEstatico(innerHtml: string, extraStyle = "") {
  return `<p data-bloque="1" style="margin:0 0 11px;font-size:13px;line-height:1.48;text-align:justify;${extraStyle}">${innerHtml}</p>`;
}

export function textosContratoArrendamiento(datos: ContratoArrendamientoDatos) {
  const personalizadas = datos.clausulas_personalizadas ?? {};
  const arrendadores = listarPersonasArras(datos.arrendadores);
  const arrendatarios = listarPersonasArras(datos.arrendatarios);
  const inicio = fechaDocumentoOHueco(datos.fecha_inicio);
  const fin = fechaDocumentoOHueco(datos.fecha_fin);
  const periodo = datos.renta_periodo_texto.trim() || `desde el ${inicio} al ${fin}`;
  const generados = {
    encabezado: encabezadoContratoArras(datos),
    reunidosArrendadores: `De una parte, ${parrafoParte(datos.arrendadores, "ARRENDADORA")}`,
    reunidosArrendatarios: `Y de otra parte, ${parrafoParte(datos.arrendatarios, "ARRENDATARIA")}`,
    intervienen:
      "Ambas partes actúan en su propio nombre y representación, y reconociéndose la capacidad legal suficiente para otorgar el presente contrato, a tal efecto.",
    manifiestanA: `A) Que ${arrendadores}, en adelante la parte ARRENDADORA, es propietaria de la vivienda sita en ${hueco(datos.vivienda_direccion)}, ${EMPRESA_DOCUMENTOS.lugar}; con referencia catastral ${hueco(datos.referencia_catastral)}.`,
    manifiestanB: `B) Que habiendo convenido el arrendamiento de la vivienda mencionada en el anterior manifestando a ${arrendatarios}, en adelante PARTE ARRENDATARIA, lo llevan a efecto de conformidad a lo que resulta de las siguientes,`,
    primera: `PRIMERA.- OBJETO: La parte arrendadora cede en arrendamiento a ${arrendatarios} la vivienda, que quedó descrita en el apartado A) de los manifestados.
El inmueble arrendado será dedicado exclusivamente a vivienda con exclusión de todo otro uso distinto, quedando igualmente prohibida la entrada de animales en el mismo.`,
    segunda: `SEGUNDA.- DURACIÓN: El contrato tendrá una duración de UN AÑO comenzando a contarse el mismo desde el día ${inicio} hasta el ${fin}. Llegada la fecha de vencimiento del contrato, este se prorrogará automáticamente por plazos anuales hasta que el arrendamiento alcance una duración de CINCO AÑOS.
Al contrato así prorrogado le seguirá siendo de aplicación el régimen establecido en este contrato, salvo en lo referido a la actualización de la renta, que se actualizará según lo dispuesto en la cláusula séptima.
Una vez transcurridos los primeros seis meses de vigencia contractual, la parte arrendataria podrá resolver el contrato en cualquier momento preavisando de forma fehaciente con TREINTA DÍAS de antelación.
En caso de terminación anticipada por parte del arrendatario durante el primer año de contrato según el párrafo anterior, la parte arrendataria deberá indemnizar a la parte arrendadora con una cantidad equivalente a una mensualidad de la renta en vigor por cada año del contrato que reste por cumplir. Los períodos de tiempo inferiores al año darán lugar a la parte proporcional de la indemnización. Esta indemnización no será aplicable a los sucesivos años de contrato una vez terminado el primero.`,
    tercera: `TERCERA.- PRÓRROGA: Llegada la fecha de vencimiento del contrato una vez transcurridos los CINCO primeros años, si ninguna de las partes hubiera notificado a la otra, al menos con 30 días de antelación a aquella fecha, su voluntad de no renovarlo, el contrato se prorrogará obligatoriamente por plazos anuales hasta un máximo de TRES AÑOS MÁS.
a) Si fuese el arrendador quien manifieste dicha voluntad, deberá notificarlo al arrendatario al menos con cuatro meses de antelación antes de que el contrato cumpla cinco años de duración.
b) Si es el arrendatario quien manifiesta su voluntad, deberá notificarlo al arrendador al menos con dos meses de antelación, antes de que el contrato cumpla cinco años de duración.
Una vez transcurrido el primer año de duración del contrato, no procederá la prórroga obligatoria si la parte arrendadora notifica a la parte arrendataria con al menos dos meses de antelación la necesidad de ocupar la vivienda arrendada antes del transcurso de cinco años para destinarla a vivienda permanente para sí o sus familiares en primer grado de consanguinidad o por adopción o para su cónyuge en los supuestos de sentencia firme de separación, divorcio o nulidad matrimonial. En dicho caso la parte arrendataria estará obligada a entregar la finca arrendada en dicho plazo.`,
    cuarta: `CUARTA.- RENTA: La renta se fija en ${eurosEnPalabras(datos.renta_anual)} anuales, pagaderos a razón de ${eurosEnPalabras(datos.renta_mensual)} mensuales. En este precio pactado se considera incluida la Comunidad.
El pago se efectuará por meses completos, cualquiera que fuere el día del mes en que la parte arrendataria dejare de ocupar la vivienda arrendada.
El pago se efectuará dentro de los primeros cinco días de cada mes mediante transferencia o ingreso en la cuenta corriente número ${hueco(datos.cuenta_arrendadora)} abierta a nombre de la parte arrendadora. En caso de que ésta cambiase de entidad bancaria lo ha de comunicar fehacientemente a la parte arrendataria.
En este momento, la parte arrendataria entrega a la parte arrendadora el importe de la renta correspondiente al periodo que abarca ${periodo}, que asciende a ${eurosEnPalabras(datos.renta_mensual)}.`,
    quinta: `QUINTA.- FIANZA: La parte arrendadora declara en este documento haber recibido de la parte arrendataria en concepto de fianza la cantidad de ${eurosEnPalabras(datos.fianza)} en metálico, para responder de las obligaciones derivadas del presente contrato, incluidas la renta y la obligación de devolver el inmueble arrendado y su mobiliario en perfecto estado.
En ningún caso la fianza podrá destinarse al pago de mensualidades de renta.`,
    sexta: `SEXTA.- LIQUIDACIÓN DE FIANZA: A la rescisión del contrato y para la liquidación de la fianza depositada la parte arrendataria acreditará estar al corriente en el pago de todas las obligaciones inherentes a su estancia.
En el caso de que los desperfectos existentes en la vivienda arrendada o que el importe de los recibos de agua, luz, teléfono o cualquier otro que pudiera corresponder a la parte arrendataria satisfacer, asciendan a cantidad superior a la fianza depositada, la parte arrendataria se obliga a satisfacer la diferencia en su contra en plazo de treinta días desde que la parte arrendadora se la reclame, devengando desde la citada fecha la cantidad que resulte el interés legal.
Igualmente, en el supuesto de que no hubiera gasto pendiente alguno ni desperfecto ocasionado, la parte arrendadora se compromete a devolver la fianza depositada en un plazo no superior a TREINTA días.`,
    septima: `SÉPTIMA.- REVISIÓN DE LA RENTA: A partir del primer año de vigencia contractual, la renta pactada será revisada cada DOCE MESES y se incrementará o disminuirá de lo que resulte de aplicar a la misma los Índices de Precios al Consumo que a tal fin facilite el Instituto Nacional de Estadística u organismo que lo sustituya, correspondientes a los doce meses anteriores. Se aclara expresamente que las sucesivas actualizaciones, en más o en menos, se harán tomando como base para el cálculo la última renta anual y no la renta inicial.
La facultad de la parte arrendadora para efectuar estas actualizaciones podrá ejercitarla en cualquier tiempo, una vez transcurrido el de cada periodo, sin que el retraso en efectuarla o cobrarla deba entenderse como renuncia, renovación o caducidad de su derecho, y su percepción tendrá efectos retroactivos desde el mes en que proceda la actualización.
No obstante lo anterior, la renta actualizada será exigible a la parte arrendataria a partir del mes siguiente a aquel en que la parte interesada lo notifique a la otra parte por escrito, expresando el porcentaje de alteración aplicado, siendo válida la notificación efectuada por nota en el recibo de la mensualidad del pago precedente.`,
    octava:
      "OCTAVA.- ESTADO DE CONSERVACIÓN: La parte arrendataria manifiesta haber reconocido el inmueble arrendado, encontrándolo en buen estado para el uso a que se destina, así como las instalaciones de agua, luz y demás con que cuenta la vivienda, obligándose a devolver todo ello en perfecto estado, o en su defecto, a satisfacer en metálico el importe de los desperfectos que existan a la terminación del contrato.",
    novena:
      "NOVENA.- La parte arrendataria se obliga a notificar fehacientemente a la parte arrendadora o su representante, con UN MES de antelación, su propósito de cesar en el arrendamiento.",
    decima:
      "DÉCIMA.- Asume la parte arrendataria el compromiso de usar los muebles y enseres respondiendo de todos los deterioros que los mismos puedan sufrir y que no provengan del desgaste propio de su normal uso; comprometiéndose a dejar la vivienda en perfecto estado a la finalización del contrato, tal como la recibe.",
    undecima:
      "UNDÉCIMA.- GASTOS: Serán de cuenta y cargo de la parte arrendataria los gastos de agua, luz, teléfono, si lo hubiere, y en general todos aquellos derivados del uso de la vivienda, de los cuales deberá realizar un cambio de domiciliación de los mismos.",
    duodecima:
      "DUODÉCIMA.- OBRAS: No podrá la parte arrendataria realizar obras de cualquier género en el inmueble alquilado, ni modificar o sustituir las instalaciones existentes, sin previo permiso escrito de la parte arrendadora, y si ésta lo otorgase, todas cuantas realizase quedarán en beneficio de la misma, sin indemnización alguna por parte de la parte arrendadora.",
    decimotercera:
      "DECIMOTERCERA.- RENUNCIA A LA ADQUISICIÓN PREFERENTE: Se hace expresa renuncia de la parte arrendataria al derecho de tanteo y retracto, no siendo aplicable, por tanto, lo dispuesto en el art. 31 de la Ley 29/1994 de Arrendamientos Urbanos.",
    decimocuarta:
      "DECIMOCUARTA.- JURISDICCIÓN: Para la discusión de cuantas cuestiones pudieran derivarse de la interpretación o desarrollo del presente contrato, ambas partes, con renuncia al fuero que pudiera corresponderles, se someten de forma expresa a la jurisdicción y competencia de los Juzgados y Tribunales de A Coruña.",
    decimoquinta: `DECIMOQUINTA.- SEGURO DE ALQUILER: La parte arrendataria hará entrega a la parte arrendadora de un seguro de alquiler a la entrega de las llaves, para garantizar el cumplimiento de las obligaciones a cargo de la parte arrendataria dimanantes del presente contrato. Este seguro de alquiler es contratado con la compañía de seguros DAS, a través de la CORREDURÍA COSNOR, por un importe anual de ${eurosEnPalabras(datos.seguro_importe)} destinado a cubrir posibles impagos o daños derivados del arrendamiento. Dicho seguro de alquiler tendrá una vigencia anual y se renovará a su vencimiento por periodos anuales sucesivos mientras este contrato se encuentre en vigor, por lo que la parte arrendataria hará ingreso en el nº de cuenta indicado en este contrato del importe que corresponda en cada renovación; en caso de no renovarse o no efectuar la parte arrendataria el pago de dicho seguro la parte arrendadora podrá rescindir el presente contrato.`,
    decimosexta: clausulaProteccionDatosContrato({ prefijo: "DECIMOSEXTA.-" }),
    cierre:
      "Y en prueba de conformidad, suscriben este documento por duplicado ejemplar y a un solo efecto, en el lugar y fecha del encabezamiento.",
  } satisfies Record<ClausulaArrendamientoKey, string>;

  const textos = {} as Record<ClausulaArrendamientoKey, string>;
  for (const key of Object.keys(generados) as ClausulaArrendamientoKey[]) {
    textos[key] = aplicarPersonalizacion(key, generados[key], personalizadas);
  }
  return textos;
}

export function htmlContratoArrendamiento(
  datos: ContratoArrendamientoDatos,
  opts?: { editable?: boolean }
): string {
  const t = textosContratoArrendamiento(datos);
  const nombres = [...nombresAResaltar(datos.arrendadores), ...nombresAResaltar(datos.arrendatarios)];
  const editable = opts?.editable !== false;
  const render = (s: string) => htmlConNegrita(s, nombres).replace(/\n/g, "<br />");
  const clausula = (key: ClausulaArrendamientoKey, inner: string, extra = "") =>
    editable ? bloqueEditable(key, inner, extra) : bloqueEstatico(inner, extra);

  const bloques =
    clausula("encabezado", render(t.encabezado), "text-align:center;margin-bottom:22px;font-size:13.5px;") +
    h("CONTRATO DE ARRENDAMIENTO DE VIVIENDA") +
    h("REUNIDOS") +
    clausula("reunidosArrendadores", render(t.reunidosArrendadores)) +
    clausula("reunidosArrendatarios", render(t.reunidosArrendatarios)) +
    h("INTERVIENEN") +
    clausula("intervienen", render(t.intervienen)) +
    h("MANIFIESTAN") +
    clausula("manifiestanA", render(t.manifiestanA)) +
    clausula("manifiestanB", render(t.manifiestanB)) +
    h("CLÁUSULAS") +
    clausula("primera", render(t.primera)) +
    clausula("segunda", render(t.segunda)) +
    clausula("tercera", render(t.tercera)) +
    clausula("cuarta", render(t.cuarta)) +
    clausula("quinta", render(t.quinta)) +
    clausula("sexta", render(t.sexta)) +
    clausula("septima", render(t.septima)) +
    clausula("octava", render(t.octava)) +
    clausula("novena", render(t.novena)) +
    clausula("decima", render(t.decima)) +
    clausula("undecima", render(t.undecima)) +
    clausula("duodecima", render(t.duodecima)) +
    clausula("decimotercera", render(t.decimotercera)) +
    clausula("decimocuarta", render(t.decimocuarta)) +
    clausula("decimoquinta", render(t.decimoquinta)) +
    clausula("decimosexta", render(t.decimosexta)) +
    clausula("cierre", render(t.cierre), "margin-top:18px;") +
    `<div data-bloque="1" data-evitar-corte="1" class="pdf-firmas" style="margin-top:36px;display:flex;justify-content:space-between;gap:40px;">
        <div style="flex:1;text-align:center;">
          <p style="margin:0 0 64px;font-size:13px;font-weight:700;letter-spacing:0.04em;">PARTE ARRENDATARIA</p>
          <div style="border-top:1px solid #222;"></div>
        </div>
        <div style="flex:1;text-align:center;">
          <p style="margin:0 0 64px;font-size:13px;font-weight:700;letter-spacing:0.04em;">PARTE ARRENDADORA</p>
          <div style="border-top:1px solid #222;"></div>
        </div>
      </div>`;

  const body = envolverFlujoDocumento(bloques);
  return envolverDocumentoHtml({
    title: `Arrendamiento · ${EMPRESA_DOCUMENTOS.razonSocial}`,
    body,
    serif: true,
    extraCss: editable ? cssPreviewEditableArras() : cssExportContratoArras(),
  });
}

export function htmlContratoArrendamientoExport(datos: ContratoArrendamientoDatos): string {
  return htmlContratoArrendamiento(datos, { editable: false });
}

export function contratoArrendamientoPdfFilename(datos: ContratoArrendamientoDatos): string {
  const quien = slugArchivo(datos.arrendatarios[0]?.nombre || datos.arrendadores[0]?.nombre || "", "alquiler");
  const fecha = datos.fecha?.slice(0, 10) || String(new Date().getFullYear());
  return `Arrendamiento-${fecha}-${quien}.pdf`;
}

export async function downloadContratoArrendamientoPdf(datos: ContratoArrendamientoDatos) {
  const { prepararDocumentoExportHtml } = await import("./documentos-paginacion");
  const { downloadPagedHtmlPdf } = await import("./documentos-pdf");
  const html = await prepararDocumentoExportHtml(htmlContratoArrendamientoExport(datos));
  await downloadPagedHtmlPdf({
    html,
    filename: contratoArrendamientoPdfFilename(datos),
    ajustarAltura: true,
  });
}
