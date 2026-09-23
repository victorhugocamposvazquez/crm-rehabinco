import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { indiciosEncubierta } from "@/lib/captacion/portales/relacionados";
import { upsertAnuncio } from "@/lib/captacion/pipeline/upsert";
import { anuncioIdealistaVacio, mapearBrightDataIdealista, fechaPortalIdealista, parsearRespuestaDataset, registrosBrightData, urlFichaIdealista } from "./idealista";

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

  it("lee el teléfono de la respuesta de Idealista y una sola foto por imagen", () => {
    const anuncio = mapearBrightDataIdealista({
      url: "https://www.idealista.com/inmueble/111341722/",
      title: "Piso en Plaza de la Milagrosa",
      price: 298000,
      phone: null,
      telefono_ajax: { phone1: { formatted: "881 35 09 92", number: "+34881350992" } },
      publication_text: "Actualizado el 12 de septiembre",
      photos: [
        "https://img3.idealista.com/blur/WEB_LISTING/0/id.pro.es.image.master/abc/abc.jpg",
        "https://img3.idealista.com/blur/WEB_DETAIL-XL-L/0/id.pro.es.image.master/abc/abc.jpg",
        "https://img3.idealista.com/blur/WEB_DETAIL-XL-L/0/id.pro.es.image.master/def/def.jpg",
        "https://img3.idealista.com/video.master/x.mp4",
      ],
    });
    assert.ok(anuncio);
    assert.equal(anuncio.contacto_telefono, "+34881350992");
    assert.equal(anuncio.fotos?.length, 2);
    assert.match(anuncio.thumb ?? "", /WEB_DETAIL-XL-L/);
    assert.equal(anuncio.publicado_en?.slice(0, 10), fechaPortalIdealista("12 de septiembre de 2026")?.slice(0, 10));
    assert.equal(
      fechaPortalIdealista("Actualizado hace 3 días", new Date(2026, 8, 23, 12))?.slice(0, 10),
      "2026-09-20"
    );
  });

  it("ignora filas sin ficha de Idealista", () => {
    assert.equal(mapearBrightDataIdealista({ title: "sin url" }), null);
  });

  it("marca como vacía la ficha que solo trajo el id", () => {
    assert.equal(anuncioIdealistaVacio({ titulo: "Anuncio 91907401", precio: null, thumb: null }), true);
    assert.equal(
      anuncioIdealistaVacio({ titulo: "Piso en venta en Calle Costa Vella, 17", precio: 420000, thumb: "https://img3.idealista.com/a.jpg" }),
      false
    );
    assert.equal(urlFichaIdealista("91907401", null), "https://www.idealista.com/inmueble/91907401/");
    assert.equal(mapearBrightDataIdealista({ url: "https://www.idealista.com/inmueble/91907401/", phone: null }), null);
  });

  it("saca registros de un array o de un sobre data", () => {
    assert.equal(registrosBrightData([{ url: "https://www.idealista.com/inmueble/1/" }]).length, 1);
    assert.equal(registrosBrightData({ snapshot_id: "s_1" }).length, 0);
    assert.equal(registrosBrightData({ data: [{ url: "https://www.idealista.com/inmueble/2/" }] }).length, 1);
  });

  it("lee un anuncio por línea cuando el archivo no es un solo JSON", () => {
    const cuerpo = parsearRespuestaDataset(
      '{"url":"https://www.idealista.com/inmueble/1/","price":1}\n{"url":"https://www.idealista.com/inmueble/2/","price":2}\n'
    );
    assert.equal(registrosBrightData(cuerpo).length, 2);
  });

  it("se salta la línea de estado y se queda con los anuncios", () => {
    const cuerpo = parsearRespuestaDataset(
      '{"status":"building","message":"espera"}\n{"url":"https://www.idealista.com/inmueble/3/"}\n'
    );
    const registros = registrosBrightData(cuerpo);
    assert.equal(registros.length, 1);
    assert.equal(registros[0]?.url, "https://www.idealista.com/inmueble/3/");
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
