import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { notasRecordatorioCaptacion, rellenarPlantilla, telefonoWhatsapp, urlWhatsapp } from "./contacto";

describe("contacto de captación", () => {
  it("rellena la plantilla y quita el nombre vacío", () => {
    const texto = rellenarPlantilla("Hola {nombre}, soy {comercial}. Vi {titulo} en {zona}.", {
      comercial: "Hugo",
      titulo: "Ático",
      zona: "Ciudad Jardín",
      municipio: "A Coruña",
    });
    assert.equal(texto, "Hola, soy Hugo. Vi Ático en Ciudad Jardín, A Coruña.");
  });

  it("arma el enlace de WhatsApp con prefijo 34", () => {
    assert.equal(telefonoWhatsapp("+34 682 119 380"), "34682119380");
    assert.equal(telefonoWhatsapp("682119380"), "34682119380");
    const url = urlWhatsapp("682119380", "Hola");
    assert.equal(url, "https://wa.me/34682119380?text=Hola");
  });

  it("marca el recordatorio como captación", () => {
    const notas = notasRecordatorioCaptacion({
      titulo: "Ático en Ciudad Jardín",
      zona: "Ciudad Jardín",
      municipio: "A Coruña",
      telefono: "682119380",
      nombre: "Alex",
      url: "https://www.idealista.com/inmueble/112617965/",
    });
    assert.match(notas, /^Captación\n/);
    assert.match(notas, /Alex/);
    assert.match(notas, /112617965/);
  });
});
