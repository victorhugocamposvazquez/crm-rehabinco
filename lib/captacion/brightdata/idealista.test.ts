import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { indiciosEncubierta } from "@/lib/captacion/portales/relacionados";
import { upsertAnuncio } from "@/lib/captacion/pipeline/upsert";
import { mapearBrightDataIdealista, registrosBrightData } from "./idealista";

describe("mapearBrightDataIdealista", () => {
  it("traduce el JSON del collector y deja el teléfono para agrupar contactos", () => {
    const anuncio = mapearBrightDataIdealista({
      url: "https://www.idealista.com/inmueble/112520691/",
      title: "Piso en Monte Alto",
      price: "189.000 €",
      size: "78 m²",
      rooms: 3,
      bathrooms: 1,
      property_type: "flat",
      municipality: "A Coruña",
      neighborhood: "Monte Alto",
      description: "Piso luminoso. Disponemos de más opciones en la zona.",
      seller_type: "private",
      phone: "600 111 222",
      contact_name: "Ana",
    });
    assert.ok(anuncio);
    assert.equal(anuncio.fuente, "idealista");
    assert.equal(anuncio.externo_id, "112520691");
    assert.equal(anuncio.precio, 189000);
    assert.equal(anuncio.superficie, 78);
    assert.equal(anuncio.tipo, "piso");
    assert.equal(anuncio.anunciante, "particular");
    assert.equal(anuncio.municipio, "A Coruña");
    assert.equal(anuncio.contacto_telefono, "+34600111222");

    const guardado = upsertAnuncio(null, anuncio, "2026-09-22T18:00:00.000Z", null);
    assert.equal(guardado.row.contacto_clave, "tel:+34600111222");
  });

  it("acepta claves anidadas y marca agencia cuando el portal lo dice", () => {
    const anuncio = mapearBrightDataIdealista({
      listing_url: "https://www.idealista.com/inmueble/99887766/",
      property_title: "Local en el centro",
      precio: 900,
      operation: "rent",
      contact: { phone: "981 123 456", commercial_name: "Fincas Norte" },
      seller: { professional: true },
      location: { city: "A Coruña", lat: 43.36, lon: -8.41 },
    });
    assert.ok(anuncio);
    assert.equal(anuncio.operacion, "alquiler");
    assert.equal(anuncio.anunciante, "empresa");
    assert.equal(anuncio.lat, 43.36);
    assert.equal(anuncio.lng, -8.41);
    assert.equal(anuncio.nombre_comercial, "Fincas Norte");
  });

  it("ignora filas sin ficha de Idealista", () => {
    assert.equal(mapearBrightDataIdealista({ title: "sin url" }), null);
  });

  it("saca registros de un array o de un sobre data", () => {
    assert.equal(registrosBrightData([{ url: "https://www.idealista.com/inmueble/1/" }]).length, 1);
    assert.equal(registrosBrightData({ snapshot_id: "s_1" }).length, 0);
    assert.equal(registrosBrightData({ data: [{ url: "https://www.idealista.com/inmueble/2/" }] }).length, 1);
  });

  it("convive con la detección de inmobiliarias encubiertas", () => {
    const base = {
      price: "150.000 €",
      size: "70",
      property_type: "piso",
      municipality: "A Coruña",
      seller_type: "private",
      phone: "600111222",
      contact_name: "Ana",
    };
    const filas = [112520691, 112520692, 112520693].map((id, i) =>
      mapearBrightDataIdealista({
        ...base,
        url: `https://www.idealista.com/inmueble/${id}/`,
        title: `Piso ${i + 1}`,
        description: i === 2 ? "Disponemos de más pisos. Sin comisión." : "Piso de particular",
        neighborhood: i === 1 ? "Oleiros" : "Monte Alto",
      })
    );
    assert.ok(filas.every(Boolean));
    const grupo = filas.map((anuncio, i) => {
      const row = upsertAnuncio(null, anuncio!, "2026-09-22T18:00:00.000Z", null).row;
      return {
        id: String(i),
        contacto_clave: row.contacto_clave as string,
        municipio: row.municipio as string,
        tipo: row.tipo as string,
        operacion: row.operacion as "venta" | "alquiler",
        descripcion: row.descripcion as string,
        titulo: row.titulo as string,
        precio: row.precio as number,
        zona: row.zona as string,
        thumb: null,
      };
    });
    const indicios = indiciosEncubierta(grupo);
    assert.equal(indicios.aviso, "probable");
    assert.ok(indicios.lineas.some((l) => l.includes("agencia")));
  });
});
