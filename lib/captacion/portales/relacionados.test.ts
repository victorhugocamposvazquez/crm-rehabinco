import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  indiciosEncubierta,
  recuentoPorClave,
  relacionadosDe,
  textoAvisoEncubierta,
  textoPareceAgencia,
  type AnuncioRelacionable,
} from "./relacionados";

function anuncio(parcial: Partial<AnuncioRelacionable> & { id: string }): AnuncioRelacionable {
  return {
    contacto_clave: "t:600111222",
    municipio: "Oleiros",
    tipo: "piso",
    operacion: "venta",
    descripcion: null,
    titulo: `Anuncio ${parcial.id}`,
    precio: 150000,
    zona: "Oleiros",
    thumb: null,
    ...parcial,
  };
}

describe("relacionados e indicios de encubierta", () => {
  it("un anuncio no avisa", () => {
    const grupo = [anuncio({ id: "1" })];
    const indicios = indiciosEncubierta(grupo);
    assert.equal(indicios.n, 1);
    assert.equal(indicios.aviso, "ninguno");
    assert.equal(textoAvisoEncubierta(indicios), null);
  });

  it("dos anuncios marcan recuento pero no avisan", () => {
    const todos = [anuncio({ id: "1" }), anuncio({ id: "2" })];
    assert.equal(recuentoPorClave(todos).get("t:600111222"), 2);
    const indicios = indiciosEncubierta(todos);
    assert.equal(indicios.aviso, "ninguno");
    assert.equal(relacionadosDe(todos[0], todos).length, 1);
  });

  it("cinco anuncios iguales marcan probable profesional", () => {
    const grupo = Array.from({ length: 5 }, (_, i) => anuncio({ id: String(i + 1) }));
    const indicios = indiciosEncubierta(grupo);
    assert.equal(indicios.aviso, "probable");
    assert.match(textoAvisoEncubierta(indicios) ?? "", /Probable profesional/);
  });

  it("tres teléfonos iguales avisan", () => {
    const todos = [anuncio({ id: "1" }), anuncio({ id: "2" }), anuncio({ id: "3" })];
    const recuento = recuentoPorClave(todos);
    assert.equal(recuento.get("t:600111222"), 3);
    const indicios = indiciosEncubierta(todos);
    assert.equal(indicios.aviso, "posible");
    assert.match(textoAvisoEncubierta(indicios) ?? "", /3 anuncios/);
  });

  it("tres anuncios en tres municipios añaden el indicio geográfico", () => {
    const grupo = [
      anuncio({ id: "1", municipio: "Oleiros" }),
      anuncio({ id: "2", municipio: "Cambre" }),
      anuncio({ id: "3", municipio: "A Coruña" }),
    ];
    const indicios = indiciosEncubierta(grupo);
    assert.equal(indicios.aviso, "probable");
    assert.equal(indicios.lineas.some((l) => l.includes("Cambre") && l.includes("Oleiros")), true);
    const relacionados = relacionadosDe(grupo[0], grupo);
    assert.equal(relacionados.length, 2);
  });

  it("detecta venta y alquiler, tipos mixtos y jerga de agencia", () => {
    const grupo = [
      anuncio({ id: "1", tipo: "piso", operacion: "venta" }),
      anuncio({ id: "2", tipo: "local", operacion: "alquiler" }),
      anuncio({ id: "3", tipo: "terreno", operacion: "venta", descripcion: "Disponemos de varias oportunidades de inversión" }),
    ];
    const indicios = indiciosEncubierta(grupo);
    assert.equal(indicios.aviso, "probable");
    assert.equal(indicios.lineas.includes("Venta y alquiler"), true);
    assert.equal(indicios.lineas.includes("Varios tipos de inmueble"), true);
    assert.equal(indicios.lineas.includes("El texto parece de agencia"), true);
    assert.equal(textoPareceAgencia("Piso luminoso en el centro"), false);
  });
});
