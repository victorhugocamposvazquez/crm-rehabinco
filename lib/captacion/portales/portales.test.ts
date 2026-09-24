import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { anuncianteIdealista, mapearIdealista, paramsIdealistaDesdeAlerta, tipoIdealista } from "./legacy/idealista";
import { claveContacto, cuandoPublicado, diasEnPortal, paginasVisibles, pctBajada, publicadoEsCarga, publicadoHoy, textoPublicado } from "./modelo";
import { desaparecidosTrasSync, filtrarParticular, fusionarAnuncio } from "./sync";
import { enmascararClave } from "./credenciales";
import { siguienteReferencia, payloadClienteDesdeAnuncio, payloadPropiedadDesdeAnuncio, tipoInmuebleDesdeAnuncio } from "./captar";
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
    assert.equal(claveContacto(mapped.contacto_telefono, mapped.contacto_nombre, mapped.municipio), "nom:tania|oleiros");
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

    const alta = fusionarAnuncio(null, { ...particular, portal_id: "idealista" }, "2026-09-15T08:00:00.000Z", "alerta-1");
    assert.equal(alta.esNuevo, true);
    assert.equal(alta.eventos[0]?.tipo, "nuevo");

    const bajada = fusionarAnuncio(
      {
        id: "uuid",
        portal_id: "idealista",
        externo_id: "1",
        precio: 200000,
        tags: [],
        fase: "novedad",
        alerta_id: "alerta-1",
        desaparecido_en: null,
      },
      { ...particular, portal_id: "idealista", precio: 190000 },
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
          portal_id: "idealista",
          externo_id: "1",
          precio: 1,
          tags: [],
          fase: "novedad",
          alerta_id: null,
          desaparecido_en: null,
        },
        {
          id: "b",
          portal_id: "idealista",
          externo_id: "9",
          precio: 1,
          tags: [],
          fase: "captado",
          alerta_id: null,
          desaparecido_en: null,
        },
      ],
      [{ portal_id: "idealista", externo_id: "1" }],
      "2026-09-15T10:00:00.000Z"
    );
    assert.equal(fuera.length, 0);
    const perdidos = desaparecidosTrasSync(
      [
        {
          id: "a",
          portal_id: "idealista",
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
    assert.equal(publicadoEsCarga("2026-09-23T14:08:00.000Z", "2026-09-23T14:08:20.000Z"), true);
    assert.equal(publicadoEsCarga("2026-09-01T10:00:00.000Z", "2026-09-23T14:08:00.000Z"), false);
    assert.equal(publicadoHoy("2026-09-23T14:08:00.000Z", "2026-09-23T14:08:20.000Z", new Date("2026-09-23T18:00:00.000Z")), false);
    assert.equal(publicadoHoy("2026-09-23T12:00:00.000Z", "2026-09-23T18:00:00.000Z", new Date("2026-09-23T18:00:00.000Z")), true);
    assert.equal(
      textoPublicado({
        publicado_en: "2026-09-23T14:08:00.000Z",
        created_at: "2026-09-23T14:08:20.000Z",
        visto_primera_vez: "2026-09-23T14:08:20.000Z",
      }),
      "Detectado el 23/09/2026"
    );
    assert.equal(
      textoPublicado(
        { publicado_en: "2026-09-01T12:00:00.000Z", created_at: "2026-09-23T14:08:00.000Z" },
        new Date("2026-09-23T18:00:00.000Z")
      ),
      "01/09/2026"
    );
    assert.deepEqual(paginasVisibles(1, 3), [1, 2, 3]);
    assert.deepEqual(paginasVisibles(14, 337), [1, "…", 13, 14, 15, "…", 337]);
  });

  it("escribe cuándo se publicó como lo lee una persona", () => {
    const ahora = new Date(2026, 3, 24, 18, 0, 0);
    assert.equal(cuandoPublicado(new Date(2026, 3, 24, 17, 30).toISOString(), ahora), "hace 30 minutos");
    assert.equal(cuandoPublicado(new Date(2026, 3, 24, 8, 0).toISOString(), ahora), "hace 10 horas");
    assert.equal(cuandoPublicado(new Date(2026, 3, 23, 9, 0).toISOString(), ahora), "Ayer");
    assert.equal(cuandoPublicado(new Date(2026, 3, 22, 9, 0).toISOString(), ahora), "22/04/2026");
    assert.equal(cuandoPublicado("2026-04-24T12:00:00.000Z", ahora), "Hoy");
  });

  it("prepara cliente ofertante e inmueble PORTAL al captar", () => {
    const anuncio = {
      contacto_nombre: "Tania",
      contacto_telefono: "600 111 222",
      titulo: "Piso en Oleiros",
      direccion: "Calle A 1",
      codigo_postal: "15172",
      municipio: "Oleiros",
      anunciante: "particular" as const,
      fuente: "idealista" as const,
      url: "https://www.idealista.com/inmueble/1/",
      operacion: "venta" as const,
      precio: 150000,
      superficie: 86,
      habitaciones: 3,
      tipo: "piso",
      comercial_id: "com-1",
    };
    const cliente = payloadClienteDesdeAnuncio(anuncio, "user-1");
    assert.equal(cliente.nombre, "Tania");
    assert.equal(cliente.tipo_cliente, "particular");
    assert.equal(cliente.telefono, "600 111 222");
    const inmueble = payloadPropiedadDesdeAnuncio(anuncio, {
      userId: "user-1",
      referencia: "RHB-2026-0001",
      ofertanteId: "cli-1",
    });
    assert.equal(inmueble.origen, "PORTAL");
    assert.equal(inmueble.publicado, false);
    assert.equal(inmueble.ofertante_id, "cli-1");
    assert.equal(inmueble.precio_venta, 150000);
    assert.equal(tipoInmuebleDesdeAnuncio("casa"), "chalet");
  });

  it("enmascara la API key y no la deja entera", () => {
    assert.equal(enmascararClave(null), null);
    assert.equal(enmascararClave("abcd"), "••••");
    assert.equal(enmascararClave("idealista-secret-key"), "••••••••-key");
  });
});
