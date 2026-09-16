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
  parrafoReunidos,
  restoPrecio,
} from "./contrato-arras";
import { htmlContratoArras, textosContratoArras } from "./contrato-arras-pdf";

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
    assert.equal(listarPersonasArras(datos.vendedores), "DON Juan Pérez");
    assert.match(parrafoReunidos(datos.vendedores, "vendedora"), /parte vendedora/);
  });

  it("pasa cantidades a euros en palabras", () => {
    assert.equal(eurosEnPalabras(1), "UN EURO (1,00 €)");
    assert.match(eurosEnPalabras(21) ?? "", /VEINTIÚN EUROS \(21,00 €\)/);
    assert.match(eurosEnPalabras(150000) ?? "", /CIENTO CINCUENTA MIL EUROS \(150\.000,00 €\)/);
    assert.match(eurosEnPalabras(null), /EUROS/);
  });
});
