import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  esListadoDeDistrito,
  lugarDeAnuncioIdealista,
  lugarDeTituloIdealista,
  zonaAlGuardar,
} from "./lugar-idealista";

describe("lugar de un anuncio Idealista", () => {
  it("guarda el barrio aunque el título no traiga calle", () => {
    assert.deepEqual(lugarDeTituloIdealista("Piso en Eirís, A Coruña"), {
      municipio: "A Coruña",
      barrio: "Eirís",
    });
    assert.deepEqual(lugarDeTituloIdealista("Casa o chalet independiente en Elviña - A Zapateira, A Coruña"), {
      municipio: "A Coruña",
      barrio: "Elviña - A Zapateira",
    });
    assert.deepEqual(lugarDeTituloIdealista("Piso en Goya, Madrid"), {
      municipio: "Madrid",
      barrio: "Goya",
    });
    assert.deepEqual(lugarDeTituloIdealista("Ático en Dreta de l'Eixample, Barcelona"), {
      municipio: "Barcelona",
      barrio: "Dreta de l'Eixample",
    });
  });

  it("con calle y número, el barrio sigue siendo el lugar, no el portal", () => {
    assert.deepEqual(lugarDeTituloIdealista("Piso en Calle de la Torre, 4, Eirís, A Coruña"), {
      municipio: "A Coruña",
      barrio: "Eirís",
    });
    assert.deepEqual(lugarDeTituloIdealista("Piso en Calle de Alcalá, 10, Goya, Madrid"), {
      municipio: "Madrid",
      barrio: "Goya",
    });
    assert.deepEqual(lugarDeTituloIdealista("Piso en Paseo de Gracia, Dreta de l'Eixample, Barcelona"), {
      municipio: "Barcelona",
      barrio: "Dreta de l'Eixample",
    });
  });

  it("una calle sin barrio no se guarda como zona", () => {
    assert.deepEqual(lugarDeTituloIdealista("Piso en Calle Compostela, A Coruña"), {
      municipio: "A Coruña",
      barrio: null,
    });
    assert.deepEqual(lugarDeTituloIdealista("Piso en Calle Mayor, 12, Madrid"), {
      municipio: "Madrid",
      barrio: null,
    });
    assert.deepEqual(lugarDeTituloIdealista("Casa en Lugar Casal, Oleiros"), {
      municipio: "Oleiros",
      barrio: null,
    });
    assert.deepEqual(lugarDeTituloIdealista("Chalet en N-550, Pontevedra"), {
      municipio: "Pontevedra",
      barrio: null,
    });
    assert.deepEqual(lugarDeTituloIdealista("Ático en Paseo de Gracia, Barcelona"), {
      municipio: "Barcelona",
      barrio: null,
    });
    assert.deepEqual(lugarDeTituloIdealista("Piso en Paseo de los Puentes-Santa Margarita, A Coruña"), {
      municipio: "A Coruña",
      barrio: "Paseo de los Puentes-Santa Margarita",
    });
  });

  it("no repite la ciudad como si fuera el barrio", () => {
    assert.equal(lugarDeTituloIdealista("Piso en Coruña, A Coruña").barrio, null);
    assert.equal(
      lugarDeAnuncioIdealista({
        titulo: "Piso en Monte Alto",
        municipio: "A Coruña",
        barrio: "A Coruña",
      }).barrio,
      null
    );
  });

  it("si una pasada nueva solo trae la ciudad, no borra el barrio ya guardado", () => {
    assert.equal(zonaAlGuardar("A Coruña", "A Coruña", "Eirís"), "Eirís");
    assert.equal(zonaAlGuardar("Goya", "Madrid", "Salamanca"), "Goya");
    assert.equal(zonaAlGuardar("Madrid", "Madrid", null), "Madrid");
  });

  it("distingue el listado de un barrio del listado del municipio", () => {
    assert.equal(esListadoDeDistrito("https://www.idealista.com/venta-viviendas/a-coruna/eiris/pagina-2.htm"), true);
    assert.equal(esListadoDeDistrito("https://www.idealista.com/venta-viviendas/madrid/goya/"), true);
    assert.equal(esListadoDeDistrito("https://www.idealista.com/venta-viviendas/oleiros-a-coruna/"), false);
    assert.equal(esListadoDeDistrito("https://www.idealista.com/venta-viviendas/a-coruna/a-coruna/"), false);
    assert.equal(esListadoDeDistrito("https://www.idealista.com/venta-viviendas/a-coruna-provincia/"), false);
  });
});
