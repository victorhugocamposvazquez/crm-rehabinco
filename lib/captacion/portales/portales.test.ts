import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { anuncianteIdealista, mapearIdealista, paramsIdealistaDesdeAlerta, tipoIdealista } from "./idealista";
import { claveContacto, diasEnPortal, pctBajada } from "./modelo";
import { desaparecidosTrasSync, filtrarParticular, fusionarAnuncio } from "./sync";
import { siguienteReferencia } from "./captar";
import { centroDeZonas } from "./zonas";

describe("captación portales", () => {
  it("distingue particular y profesional de Idealista", () => {
    assert.equal(anuncianteIdealista({ userType: "private" }), "particular");
    assert.equal(anuncianteIdealista({ userType: "professional" }), "empresa");
    assert.equal(anuncianteIdealista({}, true), "empresa");
    assert.equal(tipoIdealista("flat"), "piso");
    assert.equal(tipoIdealista("chalet"), "casa");
    assert.equal(tipoIdealista("premises"), "local");
  });

  it("mapea un elemento de search a anuncio", () => {
    const mapped = mapearIdealista({
      propertyCode: 112520691,
      address: "Oleiros, área de A Coruña",
      municipality: "Oleiros",
      neighborhood: "Oleiros",
      price: 150000,
      size: 86,
      rooms: 3,
      operation: "sale",
      propertyType: "flat",
      url: "https://www.idealista.com/inmueble/112520691/",
      contactInfo: { userType: "private", contactName: "Tania" },
      thumbnail: "https://img.example/a.jpg",
      numPhotos: 14,
      latitude: 43.33,
      longitude: -8.31,
    });
    assert.ok(mapped);
    assert.equal(mapped.fuente, "idealista");
    assert.equal(mapped.externo_id, "112520691");
    assert.equal(mapped.anunciante, "particular");
    assert.equal(mapped.tipo, "piso");
    assert.equal(mapped.precio, 150000);
    assert.equal(claveContacto(mapped.contacto_telefono, mapped.contacto_nombre, mapped.municipio), "n:tania|oleiros");
  });

  it("filtra particulares y detecta bajada, alta y desaparecido", () => {
    const particular = mapearIdealista({
      propertyCode: "1",
      address: "Calle A",
      municipality: "Cambre",
      price: 200000,
      size: 80,
      contactInfo: { userType: "private", contactName: "Fran" },
    })!;
    const agencia = mapearIdealista({
      propertyCode: "2",
      address: "Calle B",
      municipality: "Cambre",
      price: 210000,
      contactInfo: { userType: "professional", commercialName: "Inmo" },
      professional: true,
    })!;
    assert.equal(filtrarParticular([particular, agencia], true).length, 1);

    const alta = fusionarAnuncio(null, particular, "2026-09-15T08:00:00.000Z", "alerta-1");
    assert.equal(alta.esNuevo, true);
    assert.equal(alta.eventos[0]?.tipo, "nuevo");

    const bajada = fusionarAnuncio(
      {
        id: "uuid",
        fuente: "idealista",
        externo_id: "1",
        precio: 200000,
        tags: [],
        fase: "novedad",
        alerta_id: "alerta-1",
        desaparecido_en: null,
      },
      { ...particular, precio: 190000 },
      "2026-09-15T09:00:00.000Z",
      "alerta-1"
    );
    assert.equal(bajada.eventos.some((e) => e.tipo === "bajada"), true);
    assert.deepEqual(bajada.row.tags, ["Bajada"]);
    assert.equal(bajada.row.precio_anterior, 200000);
    assert.match(pctBajada(200000, 190000) ?? "", /−5 %/);

    const fuera = desaparecidosTrasSync(
      [
        {
          id: "a",
          fuente: "idealista",
          externo_id: "1",
          precio: 1,
          tags: [],
          fase: "novedad",
          alerta_id: null,
          desaparecido_en: null,
        },
        {
          id: "b",
          fuente: "idealista",
          externo_id: "9",
          precio: 1,
          tags: [],
          fase: "captado",
          alerta_id: null,
          desaparecido_en: null,
        },
      ],
      [{ fuente: "idealista", externo_id: "1" }],
      "2026-09-15T10:00:00.000Z"
    );
    assert.equal(fuera.length, 0);
    const perdidos = desaparecidosTrasSync(
      [
        {
          id: "a",
          fuente: "idealista",
          externo_id: "1",
          precio: 1,
          tags: [],
          fase: "novedad",
          alerta_id: null,
          desaparecido_en: null,
        },
      ],
      [],
      "2026-09-15T10:00:00.000Z"
    );
    assert.equal(perdidos.length, 1);
    assert.equal(perdidos[0]?.evento.tipo, "retirado");
  });

  it("resuelve el centro de A Coruña y arma la búsqueda Idealista", () => {
    const centro = centroDeZonas(["Cambre", "Oleiros"]);
    assert.ok(centro);
    const params = paramsIdealistaDesdeAlerta({
      operacion: "venta",
      tipo: "piso",
      precio_max: 200000,
      m2_min: 70,
      lat: centro.lat,
      lng: centro.lng,
      radio_m: centro.radio,
      numPage: 1,
    });
    assert.equal(params.operation, "sale");
    assert.equal(params.propertyType, "homes");
    assert.equal(params.maxPrice, 200000);
  });

  it("cuenta días en portal en local", () => {
    assert.equal(diasEnPortal("2026-09-15T08:00:00", new Date(2026, 8, 15)), 0);
    assert.equal(diasEnPortal("2026-09-13T08:00:00", new Date(2026, 8, 15)), 2);
    assert.equal(siguienteReferencia(["RHB-2026-0019", "X"], 2026), "RHB-2026-0020");
  });
});
