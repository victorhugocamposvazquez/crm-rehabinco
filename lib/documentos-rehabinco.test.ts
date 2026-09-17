import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANIO_DOCUMENTO,
  EMPRESA_DOCUMENTOS,
  formatFechaDocumento,
  formatFechaEncabezado,
} from "./empresa-documentos";
import { htmlParteVisita, lineaFechaVisita, textoCuerpoParteVisita } from "./parte-visita-pdf";
import {
  contratoArrasTieneConchado,
  contratoArrasVacio,
  eurosEnPalabras,
  listarPersonasArras,
  etiquetaEstadoCivil,
  parrafoReunidos,
  restoPrecio,
} from "./contrato-arras";
import { clausulasPersonalizadasDesdeEdicion, normalizarTextoClausula } from "./contrato-arras-preview";
import { htmlContratoArras, htmlContratoArrasExport, textosContratoArras } from "./contrato-arras-pdf";

describe("documentos Rehabinco 2026", () => {
  it("no usa datos de Conchado y sí los de Rehabinco", () => {
    const visita = htmlParteVisita({
      visitante_nombre: "Ana Pérez",
      visitante_documento: "12345678A",
      inmueble_direccion: "Rúa Real 1",
      fecha_visita: "2026-10-31",
      hora_visita: "17:00",
      hora_fin: "19:00",
      calidad: "comprador",
      agente_nombre: "Hugo",
    });
    const arras = htmlContratoArras(contratoArrasVacio());
    for (const html of [visita, arras]) {
      assert.equal(/conchado|conchadopuente|B70101449/i.test(html), false);
      assert.match(html, /REHABINCO/);
      assert.match(html, /B22834005/);
      assert.match(html, /oficina@rehabinco\.com/);
    }
    assert.equal(EMPRESA_DOCUMENTOS.razonSocial.includes("CONCHADO"), false);
  });

  it("el encabezado vacío y las fechas usan 2026", () => {
    assert.equal(ANIO_DOCUMENTO, 2026);
    assert.match(formatFechaEncabezado(null), /de 2026$/);
    assert.match(formatFechaDocumento(null), /de 2026$/);
    assert.equal(formatFechaDocumento("2026-10-31", { mesMayuscula: true }), "31 de Octubre de 2026");
    assert.match(lineaFechaVisita({
      visitante_nombre: null,
      visitante_documento: null,
      inmueble_direccion: null,
      fecha_visita: "2026-10-31",
      hora_visita: "17:00",
      hora_fin: "19:00",
      calidad: "comprador",
      agente_nombre: null,
    }), /Entre las 17:00 y las 19:00 horas en A Coruña a 31 de Octubre de 2026/);
  });

  it("el parte de visita incluye el compromiso y la LOPD de Rehabinco", () => {
    const texto = textoCuerpoParteVisita({
      visitante_nombre: "Luis",
      visitante_documento: "111",
      inmueble_direccion: "Panaderas 13",
      fecha_visita: "2026-01-02",
      hora_visita: "10:00",
      hora_fin: null,
      calidad: "arrendatario",
      agente_nombre: "Marta",
    });
    assert.match(texto, /alquilar/);
    assert.match(texto, /mediación de REHABINCO/);
    assert.equal(/CONCHADO/i.test(texto), false);
    assert.equal(htmlParteVisita({
      visitante_nombre: "Luis",
      visitante_documento: "111",
      inmueble_direccion: "Panaderas 13",
      fecha_visita: "2026-01-02",
      hora_visita: "10:00",
      hora_fin: null,
      calidad: "arrendatario",
      agente_nombre: "Marta",
    }).includes("margin-top:auto"), false);
  });

  it("el contrato de arras rellena partes, resto y cláusula novena", () => {
    const datos = contratoArrasVacio();
    datos.fecha = "2026-09-16";
    datos.vendedores = [
      {
        tratamiento: "Don",
        nombre: "Juan Pérez",
        estado_civil: "casado",
        vecindad: "A Coruña",
        domicilio: "calle Real 1",
        dni: "11111111A",
      },
    ];
    datos.compradores = [
      {
        tratamiento: "Doña",
        nombre: "María López",
        estado_civil: "soltera",
        vecindad: "A Coruña",
        domicilio: "calle Linares Rivas 8",
        dni: "22222222B",
      },
    ];
    datos.precio = 150000;
    datos.arras = 15000;
    datos.plazo_escritura_dias = 60;
    const textos = textosContratoArras(datos);
    assert.match(textos.encabezado, /16 de septiembre de 2026/);
    assert.match(textos.reunidosVendedores, /DON Juan Pérez/);
    assert.match(textos.reunidosCompradores, /DOÑA María López/);
    assert.equal(restoPrecio(datos.precio, datos.arras), 135000);
    assert.match(textos.segunda, /CIENTO CINCUENTA MIL EUROS/);
    assert.match(textos.cuarta, /CIENTO TREINTA Y CINCO MIL EUROS/);
    assert.match(textos.novena, /REHABINCO, S\.L\./);
    assert.equal(contratoArrasTieneConchado(textos.novena), false);
    assert.equal(htmlContratoArras(datos).includes("margin-top:auto"), false);
    assert.equal(listarPersonasArras(datos.vendedores), "DON Juan Pérez");
    assert.match(parrafoReunidos(datos.vendedores, "vendedora"), /estado civil casado/);
    assert.match(parrafoReunidos(datos.compradores, "compradora"), /estado civil soltera/);
    assert.match(parrafoReunidos(datos.vendedores, "vendedora"), /parte vendedora/);
    assert.equal(
      etiquetaEstadoCivil({ ...datos.compradores[0], estado_civil: "casado" }),
      "casada"
    );
    datos.cuenta_vendedora = "ES12 3456 7890 1234 5678 9012";
    const html = htmlContratoArras(datos);
    assert.match(html, /<strong>DON Juan Pérez<\/strong>/);
    assert.match(html, /<strong>DOÑA María López<\/strong>/);
    assert.match(html, /<strong>QUINCE MIL EUROS \(15\.000,00 €\)<\/strong>/);
    assert.match(html, /<strong>ES12 3456 7890 1234 5678 9012<\/strong>/);
  });

  it("el HTML incluye estilos de impresión A4", () => {
    const visita = htmlParteVisita({
      visitante_nombre: "Ana",
      visitante_documento: "1",
      inmueble_direccion: "Rúa Real 1",
      fecha_visita: "2026-10-31",
      hora_visita: "17:00",
      hora_fin: "19:00",
      calidad: "comprador",
      agente_nombre: "Hugo",
    });
    assert.match(visita, /@media print/);
    assert.match(visita, /margin: 12mm 12mm 18mm 12mm/);
    assert.match(visita, /height: auto/);
    assert.match(visita, /page-break-after: auto/);
    const arras = htmlContratoArras(contratoArrasVacio(), { editable: false });
    assert.match(arras, /@media print/);
    // Cada hoja paginada por JS debe ocupar exactamente un A4 físico al imprimir.
    assert.match(arras, /@page\s*\{\s*size: A4 portrait;\s*margin: 0;/);
    assert.match(arras, /\.pdf-page\s*\{[^}]*width: 210mm !important;[^}]*height: 297mm !important;/);
    assert.match(arras, /\.pdf-page\s*\{[^}]*page-break-after: always;/);
  });

  it("respeta cláusulas personalizadas y genera bloques editables", () => {
    const datos = contratoArrasVacio();
    datos.clausulas_personalizadas = { quinta: "QUINTA: Cláusula especial acordada entre las partes." };
    const textos = textosContratoArras(datos);
    assert.match(textos.quinta, /Cláusula especial/);
    const html = htmlContratoArras(datos, { editable: true });
    assert.match(html, /data-clausula="quinta"/);
    assert.match(html, /contenteditable="true"/);
    assert.match(html, /pdf-flow/);
    const generadas = textosContratoArras({ ...datos, clausulas_personalizadas: {} });
    assert.deepEqual(
      clausulasPersonalizadasDesdeEdicion({ quinta: generadas.quinta }, generadas),
      {}
    );
    assert.equal(
      clausulasPersonalizadasDesdeEdicion({ quinta: "QUINTA: Otra redacción." }, generadas).quinta,
      "QUINTA: Otra redacción."
    );
    assert.equal(normalizarTextoClausula("a\n\nb"), "a b");
  });

  it("el HTML de exportación no repagina ni permite edición inline", () => {
    const datos = contratoArrasVacio();
    datos.fecha = "2026-09-17";
    const html = htmlContratoArrasExport(datos);
    assert.match(html, /pdf-flow/);
    assert.equal(html.includes("contenteditable"), false);
    // El encabezado (lugar y fecha) debe ser un bloque paginable o el repaginador lo pierde.
    assert.match(html, /<p data-bloque="1"[^>]*>En A Coruña, a 17 de septiembre de 2026<\/p>/);
    assert.equal(/class="pdf-page"/.test(html), false);
    assert.match(html, /break-inside: auto/);
    assert.match(html, /\.pdf-firmas[\s\S]*break-inside: avoid-page/);
  });

  it("un contrato nuevo tiene una persona por parte", () => {
    const vacio = contratoArrasVacio();
    assert.equal(vacio.vendedores.length, 1);
    assert.equal(vacio.compradores.length, 1);
    assert.equal(vacio.vendedores[0]?.tratamiento, "Don");
    assert.equal(vacio.compradores[0]?.tratamiento, "Don");
  });

  it("pasa cantidades a euros en palabras", () => {
    assert.equal(eurosEnPalabras(1), "UN EURO (1,00 €)");
    assert.match(eurosEnPalabras(21) ?? "", /VEINTIÚN EUROS \(21,00 €\)/);
    assert.match(eurosEnPalabras(150000) ?? "", /CIENTO CINCUENTA MIL EUROS \(150\.000,00 €\)/);
    assert.match(eurosEnPalabras(null), /EUROS/);
  });
});
